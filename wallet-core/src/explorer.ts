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

type FetchLike = (url: string, init?: { method?: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

const ADDRESS_RE = /^[a-zA-Z0-9]{14,90}$/;
const TXID_RE = /^[0-9a-f]{64}$/;
const HEX_RE = /^(?:[0-9a-f]{2})+$/i;

export class MempoolExplorer implements Explorer {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
    private readonly timeoutMs = 15_000,
  ) {}

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
    const res = await this.request('/tx', { method: 'POST', body: hex, headers: { 'Content-Type': 'text/plain' } });
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

  private async request(path: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(this.baseUrl + path, { ...init, signal: ctrl.signal });
      if (!res.ok) throw new ExplorerError(`Explorador respondeu com erro HTTP ${res.status}.`, res.status);
      return res;
    } catch (e) {
      if (e instanceof ExplorerError) throw e;
      throw new ExplorerError('Falha de rede ao consultar o explorador.');
    } finally {
      clearTimeout(timer);
    }
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
