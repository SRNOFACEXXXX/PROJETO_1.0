import { describe, expect, it } from 'vitest';
import {
  areaPath,
  candleShape,
  computeStats,
  downsample,
  formatBrl,
  formatCompact,
  formatPct,
  formatTime,
  linePath,
  nearestIndex,
  niceTicks,
  scale,
  type Candle,
} from '../src/index.js';

const candle = (o: number, h: number, l: number, c: number, v = 1, t = 0): Candle => ({ time: t, open: o, high: h, low: l, close: c, volume: v });

describe('computeStats', () => {
  it('variação, máxima, mínima e volume da janela', () => {
    const s = computeStats([candle(100, 120, 95, 110, 2, 1), candle(110, 130, 105, 125, 3, 2), candle(125, 126, 80, 90, 5, 3)]);
    expect(s).toMatchObject({ first: 100, last: 90, change: -10, high: 130, low: 80, volume: 10 });
    expect(s.changePct).toBeCloseTo(-10, 10);
  });
  it('uma só vela e lista vazia', () => {
    expect(computeStats([candle(50, 60, 40, 55)]).changePct).toBeCloseTo(10, 10);
    expect(() => computeStats([])).toThrow(RangeError);
  });
  it('abertura zero não divide por zero', () => {
    expect(computeStats([candle(0, 1, 0, 1)]).changePct).toBe(0);
  });
});

describe('niceTicks (eixo Y)', () => {
  it('0..100 vira passos redondos', () => {
    const t = niceTicks(0, 100, 5);
    expect(t.ticks).toEqual([0, 20, 40, 60, 80, 100]);
    expect([t.min, t.max]).toEqual([0, 100]);
  });
  it('faixa estreita em preços altos', () => {
    const t = niceTicks(419_100, 420_900, 4);
    expect(t.min).toBeLessThanOrEqual(419_100);
    expect(t.max).toBeGreaterThanOrEqual(420_900);
    expect(t.ticks.length).toBeGreaterThanOrEqual(3);
  });
  it('faixa minúscula (moeda de centavos) mantém precisão', () => {
    const t = niceTicks(0.4201, 0.4302, 5);
    expect(t.ticks.every((v) => Number.isFinite(v))).toBe(true);
    expect(t.min).toBeLessThanOrEqual(0.4201);
    expect(t.max).toBeGreaterThanOrEqual(0.4302);
  });
  it('mínimo igual ao máximo e limites invertidos', () => {
    const flat = niceTicks(50, 50);
    expect(flat.min).toBeLessThan(50);
    expect(flat.max).toBeGreaterThan(50);
    expect(niceTicks(10, 0).ticks).toEqual(niceTicks(0, 10).ticks);
  });
  it('recusa limites inválidos', () => {
    expect(() => niceTicks(Number.NaN, 1)).toThrow(RangeError);
    expect(() => niceTicks(0, Infinity)).toThrow(RangeError);
  });
  it('propriedade: 500 faixas aleatórias cobrem os dados, crescem e têm tamanho razoável', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let i = 0; i < 500; i++) {
      const min = rnd() * 10 ** (rnd() * 8 - 3);
      const max = min + rnd() * 10 ** (rnd() * 8 - 4) + 1e-9;
      const t = niceTicks(min, max, 5);
      expect(t.min).toBeLessThanOrEqual(min + 1e-9);
      expect(t.max).toBeGreaterThanOrEqual(max - 1e-9);
      expect(t.ticks.length).toBeGreaterThanOrEqual(2);
      expect(t.ticks.length).toBeLessThanOrEqual(12);
      for (let k = 1; k < t.ticks.length; k++) expect(t.ticks[k]!).toBeGreaterThan(t.ticks[k - 1]!);
    }
  });
});

describe('escala e caminhos SVG', () => {
  it('scale leva os extremos do domínio aos da imagem (y invertido)', () => {
    const y = scale(100, 200, 300, 0);
    expect(y(100)).toBe(300);
    expect(y(200)).toBe(0);
    expect(y(150)).toBe(150);
  });
  it('domínio de um ponto devolve o meio', () => {
    expect(scale(5, 5, 0, 100)(5)).toBe(50);
  });
  it('linePath e areaPath', () => {
    const pts: Array<[number, number]> = [[0, 10], [10, 20.456], [20, 5]];
    expect(linePath(pts)).toBe('M0 10 L10 20.46 L20 5');
    expect(areaPath(pts, 100)).toBe('M0 10 L10 20.46 L20 5 L20 100 L0 100 Z');
    expect(linePath([])).toBe('');
    expect(areaPath([], 10)).toBe('');
  });
  it('nunca produz NaN no caminho', () => {
    expect(linePath([[0, 1], [1, 2]])).not.toContain('NaN');
  });
});

describe('toque no gráfico', () => {
  it('nearestIndex: extremos, meio, fora da área e uma só vela', () => {
    expect(nearestIndex(0, 0, 100, 11)).toBe(0);
    expect(nearestIndex(100, 0, 100, 11)).toBe(10);
    expect(nearestIndex(50, 0, 100, 11)).toBe(5);
    expect(nearestIndex(-30, 0, 100, 11)).toBe(0);
    expect(nearestIndex(400, 0, 100, 11)).toBe(10);
    expect(nearestIndex(50, 0, 100, 1)).toBe(0);
    expect(nearestIndex(50, 100, 100, 5)).toBe(0);
  });
});

describe('geometria das velas', () => {
  const y = scale(0, 100, 100, 0);
  it('vela de alta: corpo da abertura ao fechamento, pavio da mínima à máxima', () => {
    const s = candleShape(candle(40, 80, 20, 60), 10, 6, y);
    expect(s.up).toBe(true);
    expect(s.bodyTop).toBe(40); // y(60)
    expect(s.bodyHeight).toBe(20);
    expect(s.wickTop).toBe(20); // y(80)
    expect(s.wickBottom).toBe(80); // y(20)
  });
  it('vela de baixa', () => {
    const s = candleShape(candle(60, 80, 20, 40), 0, 6, y);
    expect(s.up).toBe(false);
    expect(s.bodyHeight).toBe(20);
  });
  it('doji (abertura = fechamento) ainda aparece, com altura mínima de 1 px', () => {
    expect(candleShape(candle(50, 60, 40, 50), 0, 6, y).bodyHeight).toBe(1);
  });
});

describe('downsample', () => {
  it('lista curta não muda', () => {
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });
  it('mantém primeiro, último e os extremos globais; respeita o limite', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const data = Array.from({ length: 1000 }, () => rnd() * 100);
    data[333] = 1000;
    data[777] = -500;
    const out = downsample(data, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out[0]).toBe(data[0]);
    expect(out[out.length - 1]).toBe(data[999]);
    expect(Math.max(...out)).toBe(1000);
    expect(Math.min(...out)).toBe(-500);
  });
  it('limite pequeno demais devolve cópia', () => {
    expect(downsample([1, 2, 3, 4], 2)).toEqual([1, 2, 3, 4]);
  });
});

describe('formatação pt-BR', () => {
  it.each([
    [419_873, 'R$ 419.873'],
    [1_234_567.89, 'R$ 1.234.568'],
    [12.3456, 'R$ 12,35'],
    [537.9, 'R$ 537,90'],
    [0.4265, 'R$ 0,4265'],
    [0.000012, 'R$ 0,000012'],
    [0, 'R$ 0,000000'],
    [-5.5, '-R$ 5,50'],
    [Number.NaN, '—'],
  ])('formatBrl(%s) = %s', (v, out) => expect(formatBrl(v)).toBe(out));

  it.each([
    [1.972, '+1,97%'],
    [-0.4, '−0,40%'],
    [0, '0,00%'],
    [123.456, '+123,46%'],
    [Number.NaN, '—'],
  ])('formatPct(%s) = %s', (v, out) => expect(formatPct(v)).toBe(out));

  it.each([
    [999, '999'],
    [1234, '1,23 mil'],
    [5_600_000, '5,6 mi'],
    [2_000_000_000, '2 bi'],
    [Number.NaN, '—'],
  ])('formatCompact(%s) = %s', (v, out) => expect(formatCompact(v)).toBe(out));

  it('formatTime por janela (fuso fixo em UTC para ser determinístico)', () => {
    const t = Date.UTC(2026, 9, 13, 19, 5); // 13/10/2026 19:05 UTC
    expect(formatTime(t, '24H', 0)).toBe('19:05');
    expect(formatTime(t, '7D', 0)).toBe('13/10 19:05');
    expect(formatTime(t, '1M', 0)).toBe('13/10');
    expect(formatTime(t, '3M', 0)).toBe('13/10');
    expect(formatTime(t, '1A', 0)).toBe('13/10/26');
    expect(formatTime(t, '24H', -180)).toBe('16:05'); // Brasília, UTC-3
    expect(formatTime(Date.UTC(2026, 0, 1, 1, 0), '1A', -180)).toBe('31/12/25'); // vira o ano
  });
});
