import { describe, expect, it } from 'vitest';
import {
  ASSETS,
  MarketClient,
  MarketError,
  RateLimitedError,
  TIMEFRAMES,
  TIMEFRAME_ORDER,
  parseCandles,
  parseTicker,
} from '../src/index.js';

const T0 = 1_791_925_200_000;
const row = (i: number, o = 100, h = 110, l = 90, c = 105, v = 3) => [T0 + i * 3_600_000, String(o), String(h), String(l), String(c), String(v), T0, '0', 1, '0', '0', '0'];
const ticker = (symbol = 'BTCBRL', over: Record<string, string> = {}) => ({
  symbol, lastPrice: '419873.00', openPrice: '411754.00', highPrice: '421250.00', lowPrice: '406358.00', volume: '97.9', priceChangePercent: '1.972', ...over,
});

function client(replies: Array<{ status: number; body?: unknown }>) {
  const urls: string[] = [];
  let n = 0;
  const fetchImpl = async (url: string) => {
    urls.push(url);
    const r = replies[Math.min(n++, replies.length - 1)]!;
    return { ok: r.status < 300, status: r.status, text: async () => JSON.stringify(r.body ?? null), headers: { get: () => null } };
  };
  return { c: new MarketClient(fetchImpl, { sleep: async () => undefined, minGapMs: 0, random: () => 0 }), urls };
}

describe('catálogo', () => {
  it('janelas cobrem o período anunciado (intervalo x quantidade de velas)', () => {
    const day = 86_400_000;
    const span = (k: keyof typeof TIMEFRAMES) => (TIMEFRAMES[k].intervalMs * TIMEFRAMES[k].limit) / day;
    expect(span('24H')).toBe(1);
    expect(span('7D')).toBe(7);
    expect(span('1M')).toBe(30);
    expect(span('3M')).toBe(90);
    expect(span('1A')).toBe(365);
    expect(TIMEFRAME_ORDER).toHaveLength(5);
  });

  it('todas as janelas pedem no máximo 1000 velas (limite da API)', () => {
    for (const k of TIMEFRAME_ORDER) expect(TIMEFRAMES[k].limit).toBeLessThanOrEqual(1000);
  });

  it('ativos: pares únicos, válidos e em reais', () => {
    const symbols = ASSETS.map((a) => a.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    for (const a of ASSETS) {
      expect(a.symbol).toMatch(/^[A-Z0-9]{5,12}$/);
      expect(a.symbol).toBe(a.base + 'BRL');
    }
  });
});

describe('MarketClient', () => {
  it('pede todas as cotações em UMA consulta e converte os campos', async () => {
    const { c, urls } = client([{ status: 200, body: [ticker('BTCBRL'), ticker('ETHBRL', { lastPrice: '12606.77' })] }]);
    const t = await c.getTickers(['BTCBRL', 'ETHBRL']);
    expect(urls).toHaveLength(1);
    expect(decodeURIComponent(urls[0]!)).toContain('symbols=["BTCBRL","ETHBRL"]');
    expect(t[0]).toMatchObject({ symbol: 'BTCBRL', last: 419873, changePct: 1.972 });
    expect(t[1]!.last).toBe(12606.77);
  });

  it.each(TIMEFRAME_ORDER)('janela %s usa o intervalo e a quantidade certos', async (k) => {
    const { c, urls } = client([{ status: 200, body: [row(0), row(1)] }]);
    await c.getCandles('BTCBRL', TIMEFRAMES[k]);
    expect(urls[0]).toContain(`symbol=BTCBRL&interval=${TIMEFRAMES[k].interval}&limit=${TIMEFRAMES[k].limit}`);
  });

  it('rejeita símbolos perigosos ou malformados antes de qualquer consulta', async () => {
    const { c, urls } = client([{ status: 200, body: [] }]);
    for (const bad of ['btcbrl', 'BTC/BRL', '../../x', 'BTCBRL&limit=1', '', 'A'.repeat(40)]) {
      await expect(c.getCandles(bad, TIMEFRAMES['7D'])).rejects.toBeInstanceOf(MarketError);
      await expect(c.getTickers([bad])).rejects.toBeInstanceOf(MarketError);
    }
    expect(urls).toHaveLength(0);
  });

  it('429 seguido de sucesso: tenta de novo e entrega os dados', async () => {
    const { c, urls } = client([{ status: 429 }, { status: 200, body: [row(0)] }]);
    expect(await c.getCandles('BTCBRL', TIMEFRAMES['7D'])).toHaveLength(1);
    expect(urls).toHaveLength(2);
  });

  it('429 sem fim vira erro de servidor ocupado (a interface mostra e tenta de novo)', async () => {
    const { c } = client([{ status: 429 }]);
    await expect(c.getTickers(['BTCBRL'])).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('lista vazia de cotações não faz consulta', async () => {
    const { c, urls } = client([{ status: 200, body: [] }]);
    expect(await c.getTickers([])).toEqual([]);
    expect(urls).toHaveLength(0);
  });
});

describe('validação das respostas (dados quebrados ou hostis)', () => {
  const bad = (r: unknown[]) => () => parseCandles(r);

  it('aceita velas coerentes', () => {
    const c = parseCandles([row(0), row(1), row(2)]);
    expect(c).toHaveLength(3);
    expect(c[0]).toMatchObject({ open: 100, high: 110, low: 90, close: 105, volume: 3 });
  });

  it('recusa máxima menor que mínima e corpo fora do pavio', () => {
    expect(bad([row(0, 100, 80, 90)])).toThrow(MarketError);
    expect(bad([row(0, 120, 110, 90)])).toThrow(MarketError); // abertura acima da máxima
    expect(bad([row(0, 100, 110, 90, 95 - 10)])).toThrow(MarketError); // fechamento abaixo da mínima
  });

  it('recusa tempo repetido ou fora de ordem', () => {
    expect(bad([row(1), row(0)])).toThrow('fora de ordem');
    expect(bad([row(1), row(1)])).toThrow('fora de ordem');
  });

  it('recusa números inválidos, negativos e texto', () => {
    expect(bad([[T0, 'abc', '1', '1', '1', '1']])).toThrow(MarketError);
    expect(bad([[T0, '-1', '1', '1', '1', '1']])).toThrow(MarketError);
    expect(bad([[T0, '1', '1', '1', '1', 'NaN']])).toThrow(MarketError);
    expect(bad([[T0, null, '1', '1', '1', '1']])).toThrow(MarketError);
    expect(bad([['x', '1', '1', '1', '1', '1']])).toThrow(MarketError);
  });

  it('recusa linhas curtas ou que não são lista', () => {
    expect(bad([[T0, '1', '1']])).toThrow(MarketError);
    expect(bad(['lixo'])).toThrow(MarketError);
    expect(bad([null])).toThrow(MarketError);
  });

  it('cotação: recusa preço zero, variação absurda e campos ausentes', () => {
    expect(() => parseTicker(ticker('BTCBRL', { lastPrice: '0' }))).toThrow(MarketError);
    expect(() => parseTicker(ticker('BTCBRL', { priceChangePercent: '99999' }))).toThrow(MarketError);
    expect(() => parseTicker(ticker('BTCBRL', { lastPrice: 'x' }))).toThrow(MarketError);
    expect(() => parseTicker({ lastPrice: '1' })).toThrow(MarketError);
    expect(() => parseTicker(null)).toThrow(MarketError);
  });

  it('o cliente recusa resposta que não é lista', async () => {
    const { c } = client([{ status: 200, body: { erro: 'x' } }]);
    await expect(c.getTickers(['BTCBRL'])).rejects.toBeInstanceOf(MarketError);
    const e = client([{ status: 200, body: [] }]);
    await expect(e.c.getCandles('BTCBRL', TIMEFRAMES['7D'])).rejects.toThrow('Sem dados');
  });
});
