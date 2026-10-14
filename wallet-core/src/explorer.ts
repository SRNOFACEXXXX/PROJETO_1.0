/** Cliente mínimo da API REST do mempool.space (injetável para testes). */
import { HttpError, ResilientHttp, type FetchLike, type HttpOptions } from './http.js';

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

export interface RawTxIo {
  address: string | null;
  value: bigint;
}

export interface RawTx {
  txid: string;
  confirmed: boolean;
  blockHeight: number | null;
  /** ms desde a época, só para transações confirmadas. */
  blockTime: number | null;
  /** Taxa paga, em satoshis (a API informa). */
  fee: bigint;
  inputs: RawTxIo[];
  outputs: RawTxIo[];
}

/** Recursos extras usados pela tela Atividade. */
export interface ActivityExplorer extends Explorer {
  getAddressTxs(address: string): Promise<RawTx[]>;
  getTipHeight(): Promise<number>;
}

export class ExplorerError extends HttpError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = 'ExplorerError';
  }
}

export type ExplorerOptions = HttpOptions;

const ADDRESS_RE = /^[a-zA-Z0-9]{14,90}$/;
const TXID_RE = /^[0-9a-f]{64}$/;
const HEX_RE = /^(?:[0-9a-f]{2})+$/i;

export class MempoolExplorer implements ActivityExplorer {
  private readonly http: ResilientHttp;

  constructor(
    baseUrl: string,
    fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
    options: ExplorerOptions | number = {},
  ) {
    const opts = typeof options === 'number' ? { timeoutMs: options } : options;
    this.http = new ResilientHttp(baseUrl, fetchImpl, opts, ExplorerError);
  }

  async getAddressInfo(address: string): Promise<AddressInfo> {
    assertAddress(address);
    const j = await this.http.json(`/address/${address}`);
    const chain = num(obj(j, 'chain_stats').tx_count);
    const pool = num(obj(j, 'mempool_stats').tx_count);
    return { txCount: chain + pool };
  }

  async getUtxos(address: string): Promise<ExplorerUtxo[]> {
    assertAddress(address);
    const j = await this.http.json(`/address/${address}/utxo`);
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
    const j = obj({ v: await this.http.json('/v1/fees/recommended') }, 'v');
    return {
      fastest: num(j.fastestFee),
      halfHour: num(j.halfHourFee),
      hour: num(j.hourFee),
      economy: num(j.economyFee),
      minimum: num(j.minimumFee),
    };
  }

  /** Últimas transações do endereço (as não confirmadas primeiro, depois as confirmadas). */
  async getAddressTxs(address: string): Promise<RawTx[]> {
    assertAddress(address);
    const j = await this.http.json(`/address/${address}/txs`);
    if (!Array.isArray(j)) throw new ExplorerError('Resposta inesperada do explorador (txs).');
    return j.map((raw) => {
      const o = raw as Record<string, unknown>;
      const txid = String(o.txid);
      if (!TXID_RE.test(txid)) throw new ExplorerError('txid inválido na resposta.');
      const status = obj(o, 'status');
      const confirmed = status.confirmed === true;
      const io = (list: unknown, key: 'vin' | 'vout'): RawTxIo[] => {
        if (!Array.isArray(list)) throw new ExplorerError(`Campo ausente: ${key}.`);
        return list.map((e) => {
          const item = (key === 'vin' ? obj(e, 'prevout') : (e as Record<string, unknown>)) as Record<string, unknown>;
          const addr = item.scriptpubkey_address;
          return { address: typeof addr === 'string' ? addr : null, value: BigInt(num(item.value)) };
        });
      };
      return {
        txid,
        confirmed,
        blockHeight: confirmed ? num(status.block_height) : null,
        blockTime: confirmed ? num(status.block_time) * 1000 : null,
        fee: BigInt(num(o.fee)),
        inputs: io(o.vin, 'vin'),
        outputs: io(o.vout, 'vout'),
      };
    });
  }

  async getTipHeight(): Promise<number> {
    const res = await this.http.request('/blocks/tip/height');
    const n = Number((await res.text()).trim());
    if (!Number.isInteger(n) || n < 0) throw new ExplorerError('Altura do bloco inválida.');
    return n;
  }

  async broadcast(hex: string): Promise<string> {
    if (!HEX_RE.test(hex)) throw new ExplorerError('Transação em formato inválido.');
    // Broadcast NÃO é repetido às cegas: um erro de rede no meio pode significar que o servidor
    // já recebeu a transação. Uma só tentativa; quem chama decide o que fazer.
    const res = await this.http.request('/tx', { method: 'POST', body: hex, headers: { 'Content-Type': 'text/plain' } }, 1);
    const txid = (await res.text()).trim();
    if (!TXID_RE.test(txid)) throw new ExplorerError('Resposta de broadcast inválida.', res.status);
    return txid;
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
