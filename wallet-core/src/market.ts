/**
 * Dados de mercado (preço e velas) para a tela Mercados.
 * Fonte: API pública de dados de mercado da Binance (sem chave, sem conta). As consultas NÃO
 * carregam nenhum dado da carteira: só o par pedido (ex.: BTCBRL).
 * Preços aqui são `number` de propósito: servem para exibição e gráficos, nunca para movimentar
 * dinheiro (valores de transação usam bigint em satoshis).
 */
import { HttpError, ResilientHttp, type FetchLike, type HttpOptions } from './http.js';

export class MarketError extends HttpError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = 'MarketError';
  }
}

export interface Candle {
  /** Abertura da vela, ms desde a época (UTC). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  last: number;
  open: number;
  high: number;
  low: number;
  /** Volume em moeda base nas últimas 24 h. */
  volume: number;
  /** Variação em % nas últimas 24 h. */
  changePct: number;
}

export interface Asset {
  /** Par negociado em reais, ex.: BTCBRL. */
  symbol: string;
  base: string;
  name: string;
}

export const ASSETS: readonly Asset[] = [
  { symbol: 'BTCBRL', base: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETHBRL', base: 'ETH', name: 'Ethereum' },
  { symbol: 'SOLBRL', base: 'SOL', name: 'Solana' },
  { symbol: 'BNBBRL', base: 'BNB', name: 'BNB' },
  { symbol: 'XRPBRL', base: 'XRP', name: 'XRP' },
  { symbol: 'ADABRL', base: 'ADA', name: 'Cardano' },
  { symbol: 'DOGEBRL', base: 'DOGE', name: 'Dogecoin' },
  { symbol: 'LTCBRL', base: 'LTC', name: 'Litecoin' },
];

export type TimeframeKey = '24H' | '7D' | '1M' | '3M' | '1A';

export interface Timeframe {
  key: TimeframeKey;
  label: string;
  /** Intervalo de cada vela, no formato da API. */
  interval: '15m' | '1h' | '4h' | '1d';
  intervalMs: number;
  /** Quantidade de velas pedidas. */
  limit: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Janelas padrão de corretoras: 24 h, 7 dias, 1 mês, 3 meses, 1 ano. */
export const TIMEFRAMES: Readonly<Record<TimeframeKey, Timeframe>> = {
  '24H': { key: '24H', label: '24H', interval: '15m', intervalMs: 15 * MIN, limit: 96 },
  '7D': { key: '7D', label: '7D', interval: '1h', intervalMs: HOUR, limit: 168 },
  '1M': { key: '1M', label: '1M', interval: '4h', intervalMs: 4 * HOUR, limit: 180 },
  '3M': { key: '3M', label: '3M', interval: '1d', intervalMs: DAY, limit: 90 },
  '1A': { key: '1A', label: '1A', interval: '1d', intervalMs: DAY, limit: 365 },
};

export const TIMEFRAME_ORDER: readonly TimeframeKey[] = ['24H', '7D', '1M', '3M', '1A'];

const SYMBOL_RE = /^[A-Z0-9]{5,12}$/;
const BASE = 'https://data-api.binance.vision/api/v3';

export class MarketClient {
  private readonly http: ResilientHttp;

  constructor(fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike, options: HttpOptions = {}, baseUrl = BASE) {
    this.http = new ResilientHttp(baseUrl, fetchImpl, { maxConcurrent: 2, minGapMs: 150, ...options }, MarketError);
  }

  /** Cotações das últimas 24 h de vários pares, em uma única consulta. */
  async getTickers(symbols: readonly string[]): Promise<Ticker[]> {
    if (symbols.length === 0) return [];
    symbols.forEach(assertSymbol);
    const q = encodeURIComponent(JSON.stringify(symbols));
    const j = await this.http.json(`/ticker/24hr?symbols=${q}`);
    if (!Array.isArray(j)) throw new MarketError('Resposta de mercado inesperada.');
    return j.map(parseTicker);
  }

  /** Velas (OHLCV) em ordem cronológica. */
  async getCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
    assertSymbol(symbol);
    const j = await this.http.json(`/klines?symbol=${symbol}&interval=${tf.interval}&limit=${tf.limit}`);
    if (!Array.isArray(j) || j.length === 0) throw new MarketError('Sem dados de mercado para este período.');
    return parseCandles(j);
  }
}

function assertSymbol(s: string): void {
  if (!SYMBOL_RE.test(s)) throw new MarketError('Par de mercado inválido.');
}

function numStr(v: unknown, what: string): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n) || n < 0) throw new MarketError(`Dado de mercado inválido (${what}).`);
  return n;
}

export function parseTicker(raw: unknown): Ticker {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || typeof o.symbol !== 'string') throw new MarketError('Cotação inválida.');
  const last = numStr(o.lastPrice, 'preço');
  if (last <= 0) throw new MarketError('Preço inválido.');
  const pct = Number(o.priceChangePercent);
  if (!Number.isFinite(pct) || Math.abs(pct) > 1000) throw new MarketError('Variação inválida.');
  return {
    symbol: o.symbol,
    last,
    open: numStr(o.openPrice, 'abertura'),
    high: numStr(o.highPrice, 'máxima'),
    low: numStr(o.lowPrice, 'mínima'),
    volume: numStr(o.volume, 'volume'),
    changePct: pct,
  };
}

export function parseCandles(rows: unknown[]): Candle[] {
  let prev = -Infinity;
  return rows.map((r) => {
    if (!Array.isArray(r) || r.length < 6) throw new MarketError('Vela inválida.');
    const time = r[0];
    if (typeof time !== 'number' || !Number.isFinite(time) || time <= prev) throw new MarketError('Velas fora de ordem.');
    prev = time;
    const c: Candle = {
      time,
      open: numStr(r[1], 'abertura'),
      high: numStr(r[2], 'máxima'),
      low: numStr(r[3], 'mínima'),
      close: numStr(r[4], 'fechamento'),
      volume: numStr(r[5], 'volume'),
    };
    if (c.high < c.low || c.open > c.high || c.open < c.low || c.close > c.high || c.close < c.low) {
      throw new MarketError('Vela inconsistente (máxima/mínima).');
    }
    return c;
  });
}
