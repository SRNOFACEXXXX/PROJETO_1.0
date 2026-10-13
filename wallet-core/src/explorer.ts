/** Cliente mínimo da API REST do mempool.space (injetável para testes). */

export interface AddressInfo {
  /** Transações já registradas (confirmadas + mempool). */
  txCount: number;
}

export interface ExplorerUtxo {
  txid: string;
  vout: number;
  value: bigint;
  confirmed: boolean;
}

export interface FeeEstimates {
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
  minimum: number;
}

export interface Explorer {
  getAddressInfo(address: string): Promise<AddressInfo>;
  getUtxos(address: string): Promise<ExplorerUtxo[]>;
  getFees(): Promise<FeeEstimates>;
  broadcast(hex: string): Promise<string>;
}

export class ExplorerError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ExplorerError';
  }
}

/** O servidor recusou por excesso de requisições (HTTP 429) mesmo após tentar de novo. */
export class RateLimitedError extends ExplorerError {
  constructor(readonly retryAfterMs: number) {
    super('O servidor de blockchain está ocupado (limite de requisições).', 429);
    this.name = 'RateLimitedError';
  }
}

type FetchLike = (
  url: string,
  init?: { method?: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers?: { get(name: string): string | null };
}>;

export interface ExplorerOptions {
  timeoutMs?: number;
  /** Tentativas por requisição (inclui a primeira). */
  maxAttempts?: number;
  /** Requisições simultâneas, para não estourar o limite do servidor público. */
  maxConcurrent?: number;
  /** Intervalo mínimo entre o início de duas requisições. */
  minGapMs?: number;
  /** Primeira espera do recuo exponencial. */
  baseDelayMs?: number;
  /** Teto da espera, inclusive a pedida por Retry-After. */
  maxDelayMs?: number;
  /** Injetáveis para teste. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const ADDRESS_RE = /^[a-zA-Z0-9]{14,90}$/;
const TXID_RE = /^[0-9a-f]{64}$/;
const HEX_RE = /^(?:[0-9a-f]{2})+$/i;
/** Respostas que valem uma nova tentativa. 4xx (exceto 429) são erro definitivo. */
const RETRYABLE = new Set([429, 502, 503, 504]);

export class MempoolExplorer implements Explorer {
  private readonly o: Required<ExplorerOptions>;
  private inFlight = 0;
  private waiters: Array<() => void> = [];
  private nextStart = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
    options: ExplorerOptions | number = {},
  ) {
    const opts = typeof options === 'number' ? { timeoutMs: options } : options;
    this.o = {
      timeoutMs: opts.timeoutMs ?? 15_000,
      maxAttempts: opts.maxAttempts ?? 5,
      maxConcurrent: opts.maxConcurrent ?? 2,
      minGapMs: opts.minGapMs ?? 120,
      baseDelayMs: opts.baseDelayMs ?? 1_000,
      maxDelayMs: opts.maxDelayMs ?? 20_000,
      sleep: opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      random: opts.random ?? Math.random,
    };
  }

  async getAddressInfo(address: string): Promise<AddressInfo> {
    assertAddress(address);
    const j = await this.getJson(`/address/${address}`);
    const chain = num(obj(j, 'chain_stats').tx_count);
    const pool = num(obj(j, 'mempool_stats').tx_count);
    return { txCount: chain + pool };
  }

  async getUtxos(address: string): Promise<ExplorerUtxo[]> {
    assertAddress(address);
    const j = await this.getJson(`/address/${address}/utxo`);
    if (!Array.isArray(j)) throw new ExplorerError('Resposta inesperada do explorador (utxo).');
    return j.map((raw) => {
      const o = raw as Record<string, unknown>;
      const txid = String(o.txid);
      if (!TXID_RE.test(txid)) throw new ExplorerError('txid inválido na resposta.');
      const value = num(o.value);
      return {
        txid,
        vout: num(o.vout),
        value: BigInt(value),
        confirmed: obj(o, 'status').confirmed === true,
      };
    });
  }

  async getFees(): Promise<FeeEstimates> {
    const j = obj({ v: await this.getJson('/v1/fees/recommended') }, 'v');
    return {
      fastest: num(j.fastestFee),
      halfHour: num(j.halfHourFee),
      hour: num(j.hourFee),
      economy: num(j.economyFee),
      minimum: num(j.minimumFee),
    };
  }

  async broadcast(hex: string): Promise<string> {
    if (!HEX_RE.test(hex)) throw new ExplorerError('Transação em formato inválido.');
    // Broadcast NÃO é repetido às cegas: um erro de rede no meio pode significar que o servidor
    // já recebeu a transação. Uma só tentativa; quem chama decide o que fazer.
    const res = await this.request('/tx', { method: 'POST', body: hex, headers: { 'Content-Type': 'text/plain' } }, 1);
    const txid = (await res.text()).trim();
    if (!TXID_RE.test(txid)) throw new ExplorerError('Resposta de broadcast inválida.', res.status);
    return txid;
  }

  private async getJson(path: string): Promise<unknown> {
    const res = await this.request(path);
    try {
      return JSON.parse(await res.text());
    } catch {
      throw new ExplorerError('Resposta do explorador não é JSON válido.', res.status);
    }
  }

  private async acquire(): Promise<void> {
    if (this.inFlight >= this.o.maxConcurrent) await new Promise<void>((r) => this.waiters.push(r));
    this.inFlight++;
    const now = Date.now();
    const wait = Math.max(0, this.nextStart - now);
    this.nextStart = Math.max(now, this.nextStart) + this.o.minGapMs;
    if (wait > 0) await this.o.sleep(wait);
  }

  private release(): void {
    this.inFlight--;
    this.waiters.shift()?.();
  }

  private delayFor(attempt: number, retryAfter: string | null | undefined): number {
    const asSeconds = retryAfter ? Number(retryAfter) : NaN;
    if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.min(asSeconds * 1000, this.o.maxDelayMs);
    const exp = this.o.baseDelayMs * 2 ** attempt;
    return Math.min(exp + this.o.random() * this.o.baseDelayMs, this.o.maxDelayMs);
  }

  private async request(
    path: string,
    init: { method?: string; body?: string; headers?: Record<string, string> } = {},
    maxAttempts = this.o.maxAttempts,
  ) {
    let lastDelay = 0;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const last = attempt === maxAttempts - 1;
      await this.acquire();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.o.timeoutMs);
      try {
        const res = await this.fetchImpl(this.baseUrl + path, { ...init, signal: ctrl.signal });
        if (res.ok) return res;
        if (!RETRYABLE.has(res.status)) throw new ExplorerError(`Explorador respondeu com erro HTTP ${res.status}.`, res.status);
        lastDelay = this.delayFor(attempt, res.headers?.get('retry-after'));
        if (last) {
          if (res.status === 429) throw new RateLimitedError(lastDelay);
          throw new ExplorerError(`Explorador indisponível (HTTP ${res.status}).`, res.status);
        }
      } catch (e) {
        if (e instanceof ExplorerError) throw e;
        lastDelay = this.delayFor(attempt, null);
        if (last) throw new ExplorerError('Falha de rede ao consultar o explorador.');
      } finally {
        clearTimeout(timer);
        this.release();
      }
      await this.o.sleep(lastDelay);
    }
    throw new ExplorerError('Falha ao consultar o explorador.');
  }
}

function assertAddress(address: string): void {
  if (!ADDRESS_RE.test(address)) throw new ExplorerError('Endereço inválido.');
}

function obj(o: unknown, key: string): Record<string, unknown> {
  const v = (o as Record<string, unknown> | null)?.[key];
  if (typeof v !== 'object' || v === null) throw new ExplorerError(`Campo ausente: ${key}.`);
  return v as Record<string, unknown>;
}

function num(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new ExplorerError('Número inválido na resposta.');
  return v;
}
