/**
 * Cliente HTTP resiliente, compartilhado pelo explorador de blockchain e pelos dados de mercado.
 * Recuo exponencial (respeita Retry-After), limite de requisições simultâneas, intervalo mínimo
 * entre requisições e mensagens de erro sem detalhes internos.
 */

export class HttpError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'HttpError';
  }
}

/** O servidor recusou por excesso de requisições (HTTP 429) mesmo após tentar de novo. */
export class RateLimitedError extends HttpError {
  constructor(readonly retryAfterMs: number) {
    super('O servidor está ocupado (limite de requisições).', 429);
    this.name = 'RateLimitedError';
  }
}

export type FetchLike = (
  url: string,
  init?: { method?: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers?: { get(name: string): string | null };
}>;

export interface HttpOptions {
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

/** Respostas que valem uma nova tentativa. 4xx (exceto 429) são erro definitivo. */
const RETRYABLE = new Set([429, 502, 503, 504]);

export class ResilientHttp {
  private readonly o: Required<HttpOptions>;
  private inFlight = 0;
  private waiters: Array<() => void> = [];
  private nextStart = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike,
    options: HttpOptions = {},
    private readonly ErrorClass: new (message: string, status?: number) => HttpError = HttpError,
  ) {
    this.o = {
      timeoutMs: options.timeoutMs ?? 15_000,
      maxAttempts: options.maxAttempts ?? 5,
      maxConcurrent: options.maxConcurrent ?? 2,
      minGapMs: options.minGapMs ?? 120,
      baseDelayMs: options.baseDelayMs ?? 1_000,
      maxDelayMs: options.maxDelayMs ?? 20_000,
      sleep: options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      random: options.random ?? Math.random,
    };
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

  async request(
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
        if (!RETRYABLE.has(res.status)) throw new this.ErrorClass(`Servidor respondeu com erro HTTP ${res.status}.`, res.status);
        lastDelay = this.delayFor(attempt, res.headers?.get('retry-after'));
        if (last) {
          if (res.status === 429) throw new RateLimitedError(lastDelay);
          throw new this.ErrorClass(`Servidor indisponível (HTTP ${res.status}).`, res.status);
        }
      } catch (e) {
        if (e instanceof HttpError) throw e;
        lastDelay = this.delayFor(attempt, null);
        if (last) throw new this.ErrorClass('Falha de rede ao consultar o servidor.');
      } finally {
        clearTimeout(timer);
        this.release();
      }
      await this.o.sleep(lastDelay);
    }
    throw new this.ErrorClass('Falha ao consultar o servidor.');
  }

  async json(path: string): Promise<unknown> {
    const res = await this.request(path);
    try {
      return JSON.parse(await res.text());
    } catch {
      throw new this.ErrorClass('Resposta do servidor não é JSON válido.', res.status);
    }
  }
}
