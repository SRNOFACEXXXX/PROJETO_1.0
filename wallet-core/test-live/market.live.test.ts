/**
 * Dados de mercado AO VIVO: o que a tela Mercados vai mostrar é coerente e confere com uma
 * segunda fonte independente (CoinGecko)? Só leitura; nenhum dado de carteira é enviado.
 */
import { describe, expect, it } from 'vitest';
import { ASSETS, MarketClient, TIMEFRAMES, TIMEFRAME_ORDER, computeStats } from '../src/index.js';

const client = new MarketClient(undefined, { maxAttempts: 4 });
const COINGECKO: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', LTC: 'litecoin',
};

describe('cotações ao vivo', () => {
  it('as 8 moedas vêm coerentes (preço dentro da faixa do dia, variação plausível)', async () => {
    const tickers = await client.getTickers(ASSETS.map((a) => a.symbol));
    expect(tickers).toHaveLength(ASSETS.length);
    for (const t of tickers) {
      expect(t.last, t.symbol).toBeGreaterThan(0);
      expect(t.high, t.symbol).toBeGreaterThanOrEqual(t.low);
      expect(t.last, t.symbol).toBeGreaterThanOrEqual(t.low * 0.995);
      expect(t.last, t.symbol).toBeLessThanOrEqual(t.high * 1.005);
      expect(Math.abs(t.changePct), t.symbol).toBeLessThan(60);
    }
  }, 60_000);

  it('confere com a CoinGecko (fonte independente) em até 3%', async (ctx) => {
    const ids = Object.values(COINGECKO).join(',');
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl`);
    if (res.status === 429) return ctx.skip(); // fonte de conferência limitada: não conta como aprovado nem como falha
    expect(res.status).toBe(200);
    const other = (await res.json()) as Record<string, { brl: number }>;
    const tickers = await client.getTickers(ASSETS.map((a) => a.symbol));
    for (const a of ASSETS) {
      const mine = tickers.find((t) => t.symbol === a.symbol)!.last;
      const theirs = other[COINGECKO[a.base]!]!.brl;
      const diff = Math.abs(mine - theirs) / theirs;
      console.log(`${a.base}: Binance ${mine} | CoinGecko ${theirs} | diferença ${(diff * 100).toFixed(2)}%`);
      expect(diff, `${a.base} difere ${(diff * 100).toFixed(2)}%`).toBeLessThan(0.03);
    }
  }, 60_000);
});

describe.each(TIMEFRAME_ORDER)('velas BTC/BRL — janela %s', (key) => {
  const tf = TIMEFRAMES[key];

  it('quantidade, ordem, espaçamento e frescor', async () => {
    const candles = await client.getCandles('BTCBRL', tf);
    expect(candles.length).toBe(tf.limit);
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i]!.time - candles[i - 1]!.time).toBe(tf.intervalMs);
    }
    const age = Date.now() - candles[candles.length - 1]!.time;
    expect(age).toBeLessThan(tf.intervalMs * 2 + 120_000); // a última vela é a atual (ou a anterior)
    const spanDays = (candles[candles.length - 1]!.time - candles[0]!.time + tf.intervalMs) / 86_400_000;
    const wantDays = (tf.intervalMs * tf.limit) / 86_400_000;
    expect(Math.abs(spanDays - wantDays)).toBeLessThan(0.01);
  }, 60_000);

  it('o último fechamento bate com a cotação atual (até 1,5%) e as estatísticas fazem sentido', async () => {
    const [candles, [ticker]] = await Promise.all([client.getCandles('BTCBRL', tf), client.getTickers(['BTCBRL'])]);
    const s = computeStats(candles);
    expect(Math.abs(s.last - ticker!.last) / ticker!.last).toBeLessThan(0.015);
    expect(s.high).toBeGreaterThanOrEqual(s.low);
    expect(s.volume).toBeGreaterThan(0);
  }, 60_000);
});
