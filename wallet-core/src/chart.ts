/**
 * Matemática pura dos gráficos: escalas, eixos, caminhos SVG, estatísticas e formatação.
 * Sem React e sem SVG: o app só desenha o que estas funções calculam, e tudo aqui é testado.
 */
import type { Candle, TimeframeKey } from './market.js';

export interface Stats {
  first: number;
  last: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
}

export function computeStats(candles: readonly Candle[]): Stats {
  if (candles.length === 0) throw new RangeError('Sem velas.');
  const first = candles[0]!.open;
  const last = candles[candles.length - 1]!.close;
  let high = -Infinity;
  let low = Infinity;
  let volume = 0;
  for (const c of candles) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
    volume += c.volume;
  }
  const change = last - first;
  return { first, last, change, changePct: first > 0 ? (change / first) * 100 : 0, high, low, volume };
}

/** Marcas "bonitas" para um eixo (passos 1, 2, 2.5, 5 × 10^n), cobrindo [min, max]. */
export function niceTicks(min: number, max: number, target = 5): { ticks: number[]; min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new RangeError('Limites inválidos.');
  if (max < min) [min, max] = [max, min];
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, target);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return { ticks, min: lo, max: hi };
}

/** Escala linear: leva [d0,d1] para [r0,r1]. Se o domínio for um ponto, devolve o meio. */
export function scale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  if (d0 === d1) return () => (r0 + r1) / 2;
  const k = (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * k;
}

const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

/** Caminho SVG de uma linha por pontos (x, y) já em pixels. */
export function linePath(points: ReadonlyArray<readonly [number, number]>): string {
  if (points.length === 0) return '';
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${f2(x)} ${f2(y)}`).join(' ');
}

/** Caminho fechado (área sob a linha), descendo até a base. */
export function areaPath(points: ReadonlyArray<readonly [number, number]>, baseY: number): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)} L${f2(last[0])} ${f2(baseY)} L${f2(first[0])} ${f2(baseY)} Z`;
}

/** Índice da vela mais próxima de um toque na posição x (pixels). */
export function nearestIndex(x: number, left: number, right: number, count: number): number {
  if (count <= 1 || right <= left) return 0;
  const t = (Math.min(Math.max(x, left), right) - left) / (right - left);
  return Math.round(t * (count - 1));
}

export interface CandleShape {
  x: number;
  bodyTop: number;
  bodyHeight: number;
  wickTop: number;
  wickBottom: number;
  width: number;
  up: boolean;
}

/** Geometria de uma vela: corpo (abertura-fechamento) e pavio (máxima-mínima). */
export function candleShape(c: Candle, x: number, width: number, y: (v: number) => number): CandleShape {
  const top = y(Math.max(c.open, c.close));
  const bottom = y(Math.min(c.open, c.close));
  return {
    x,
    width,
    bodyTop: top,
    bodyHeight: Math.max(1, bottom - top), // vela sem corpo ainda aparece como traço
    wickTop: y(c.high),
    wickBottom: y(c.low),
    up: c.close >= c.open,
  };
}

/** Reduz para no máximo `max` pontos mantendo o primeiro, o último e os extremos de cada faixa. */
export function downsample(values: readonly number[], max: number): number[] {
  if (max < 3 || values.length <= max) return [...values];
  const out: number[] = [values[0]!];
  const buckets = Math.floor((max - 2) / 2);
  const size = (values.length - 2) / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = 1 + Math.floor(b * size);
    const to = Math.min(values.length - 1, 1 + Math.floor((b + 1) * size));
    let lo = from;
    let hi = from;
    for (let i = from; i < to; i++) {
      if (values[i]! < values[lo]!) lo = i;
      if (values[i]! > values[hi]!) hi = i;
    }
    const pair = lo < hi ? [lo, hi] : [hi, lo];
    out.push(values[pair[0]!]!);
    if (pair[1] !== pair[0]) out.push(values[pair[1]!]!);
  }
  out.push(values[values.length - 1]!);
  return out;
}

// ───────── Formatação (pt-BR, sem depender de Intl no Hermes) ─────────

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Reais com casas decimais adaptativas: R$ 419.873 · R$ 12,34 · R$ 0,4265 · R$ 0,000012. */
export function formatBrl(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const decimals = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  const [i, d] = a.toFixed(decimals).split('.');
  return `${v < 0 ? '-' : ''}R$ ${group(i!)}${d ? ',' + d : ''}`;
}

/** Reais sempre com 2 casas: R$ 4.360,86 (saldo total). */
export function formatBrlFixed(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}R$ ${group(i!)},${d}`;
}

/** +1,97% / −0,42% (com sinal explícito). */
export function formatPct(p: number): string {
  if (!Number.isFinite(p)) return '—';
  const s = Math.abs(p).toFixed(2).replace('.', ',');
  return `${p > 0 ? '+' : p < 0 ? '−' : ''}${s}%`;
}

/** 1.234 → "1,23 mil"; 5.600.000 → "5,6 mi". */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const fmt = (x: number) => x.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
  if (a >= 1e9) return `${fmt(n / 1e9)} bi`;
  if (a >= 1e6) return `${fmt(n / 1e6)} mi`;
  if (a >= 1e3) return `${fmt(n / 1e3)} mil`;
  return fmt(n);
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** Rótulo de tempo adequado à janela. `tzOffsetMin`: minutos a somar ao UTC (padrão: fuso do aparelho). */
export function formatTime(ms: number, tf: TimeframeKey, tzOffsetMin = -new Date().getTimezoneOffset()): string {
  const d = new Date(ms + tzOffsetMin * 60_000);
  const day = `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`;
  const hm = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  if (tf === '24H') return hm;
  if (tf === '7D') return `${day} ${hm}`;
  if (tf === '1M' || tf === '3M') return day;
  return `${day}/${String(d.getUTCFullYear()).slice(2)}`;
}
