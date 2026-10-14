import {
  areaPath,
  candleShape,
  downsample,
  formatBrl,
  formatPct,
  formatTime,
  linePath,
  nearestIndex,
  niceTicks,
  scale,
  type Candle,
  type TimeframeKey,
} from '@brbit/wallet-core';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts, trend } from './theme';

export type ChartMode = 'line' | 'candles';

const M = { top: 8, right: 80, bottom: 22, left: 0 };
/** Fração da altura útil reservada ao volume. */
const VOLUME_SHARE = 0.18;

export const trendColor = (up: boolean) => (up ? trend.up : trend.down);

const GRID = { stroke: 'rgba(255,255,255,0.07)', dash: '3 5' } as const;
const AXIS_FONT = { fontFamily: fonts.mono, fontSize: 10, fill: colors.dim } as const;

interface PriceChartProps {
  candles: readonly Candle[];
  tf: TimeframeKey;
  mode: ChartMode;
  height?: number;
  /** Vela selecionada (toque ou arrasto); `null` = nenhuma. */
  selected: number | null;
  onSelect: (index: number) => void;
  /** Texto lido por leitores de tela (e pelos testes automáticos). */
  label: string;
}

/**
 * Gráfico de preço no padrão de corretoras: linha com área ou velas, volume embaixo,
 * grade e eixo de preço à direita, marca do último preço e mira ao tocar/arrastar.
 * Todo o cálculo vem de funções puras testadas (wallet-core/chart).
 */
export function PriceChart({ candles, tf, mode, height = 300, selected, onSelect, label }: PriceChartProps) {
  const [width, setWidth] = useState(0);
  const live = useRef({ width: 0, count: 0, onSelect });
  live.current = { width, count: candles.length, onSelect };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // o ScrollView não rouba o arrasto
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
    }),
  ).current;

  function pick(x: number) {
    const { width: w, count, onSelect: cb } = live.current;
    if (w <= 0 || count === 0) return;
    cb(nearestIndex(x, 0, w - M.right, count));
  }

  const g = useMemo(() => {
    const n = candles.length;
    const plotW = Math.max(1, width - M.left - M.right);
    const plotH = height - M.top - M.bottom;
    const volH = plotH * VOLUME_SHARE;
    const priceH = plotH - volH - 6;
    const lows = mode === 'candles' ? candles.map((c) => c.low) : candles.map((c) => c.close);
    const highs = mode === 'candles' ? candles.map((c) => c.high) : candles.map((c) => c.close);
    const ticks = niceTicks(Math.min(...lows), Math.max(...highs), 4);
    const y = scale(ticks.min, ticks.max, M.top + priceH, M.top);
    const band = plotW / n;
    const x = (i: number) => M.left + (i + 0.5) * band;
    const vmax = Math.max(...candles.map((c) => c.volume), 1e-12);
    const base = M.top + plotH;
    const first = candles[0]!;
    const last = candles[n - 1]!;
    return { n, plotW, plotH, volH, priceH, ticks, y, band, x, vmax, base, up: last.close >= first.open, last };
  }, [candles, width, height, mode]);

  const color = trendColor(g.up);
  const gid = `grad-${tf}-${mode}`;

  // Quantidade de rótulos de tempo que cabem sem se sobrepor (cada um ocupa uns 100 px).
  const xLabels = useMemo(() => {
    if (g.n < 2) return [];
    const count = Math.max(2, Math.min(4, Math.floor(g.plotW / 100)));
    return Array.from({ length: count }, (_, k) => Math.round((k * (g.n - 1)) / (count - 1)));
  }, [g.n, g.plotW]);

  const points = useMemo(
    () => (mode === 'line' ? candles.map((c, i) => [g.x(i), g.y(c.close)] as [number, number]) : []),
    [candles, g, mode],
  );

  const sel = selected !== null && selected >= 0 && selected < g.n ? candles[selected]! : null;

  return (
    <View
      testID="chart"
      accessible
      accessibilityLabel={label}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height }}
      {...pan.panHandlers}
    >
      {width > 0 ? (
        <Svg width={width} height={height} pointerEvents="none">
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.28" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Grade pontilhada e eixo de preço */}
          {g.ticks.ticks.map((t) => (
            <G key={t}>
              <Line x1={M.left} x2={M.left + g.plotW} y1={g.y(t)} y2={g.y(t)} stroke={GRID.stroke} strokeDasharray={GRID.dash} />
              <SvgText x={M.left + g.plotW + 6} y={g.y(t) + 3} {...AXIS_FONT}>
                {formatBrl(t)}
              </SvgText>
            </G>
          ))}

          {/* Volume */}
          {candles.map((c, i) => (
            <Rect
              key={`v${c.time}`}
              x={g.x(i) - Math.max(0.5, g.band * 0.35)}
              width={Math.max(1, g.band * 0.7)}
              y={g.base - (c.volume / g.vmax) * g.volH}
              height={Math.max(0.5, (c.volume / g.vmax) * g.volH)}
              fill={trendColor(c.close >= c.open)}
              opacity={0.26}
            />
          ))}

          {/* Preço */}
          {mode === 'line' ? (
            <>
              <Path d={areaPath(points, M.top + g.priceH)} fill={`url(#${gid})`} />
              {/* halo neon: o mesmo traço, mais largo e translúcido, por baixo */}
              <Path d={linePath(points)} stroke={color} strokeWidth={7} opacity={0.16} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              <Path d={linePath(points)} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : (
            candles.map((c, i) => {
              const s = candleShape(c, g.x(i), Math.max(1, g.band * 0.7), g.y);
              const col = trendColor(s.up);
              return (
                <G key={`c${c.time}`}>
                  <Line x1={s.x} x2={s.x} y1={s.wickTop} y2={s.wickBottom} stroke={col} strokeWidth={Math.min(1, s.width)} />
                  <Rect x={s.x - s.width / 2} y={s.bodyTop} width={s.width} height={s.bodyHeight} fill={col} />
                </G>
              );
            })
          )}

          {/* Último preço */}
          <Line x1={M.left} x2={M.left + g.plotW} y1={g.y(g.last.close)} y2={g.y(g.last.close)} stroke={color} strokeWidth={0.8} strokeDasharray="4 4" opacity={0.8} />
          <Rect x={M.left + g.plotW + 2} y={g.y(g.last.close) - 8} width={M.right - 4} height={16} rx={8} fill={color} />
          <SvgText x={M.left + g.plotW + 8} y={g.y(g.last.close) + 3.5} fill="#050505" fontSize={10} fontFamily={fonts.monoMed}>
            {formatBrl(g.last.close)}
          </SvgText>

          {/* Eixo de tempo */}
          {xLabels.map((i, k) => (
            <SvgText
              key={i}
              x={g.x(i)}
              y={height - 6}
              {...AXIS_FONT}
              textAnchor={k === 0 ? 'start' : k === xLabels.length - 1 ? 'end' : 'middle'}
            >
              {formatTime(candles[i]!.time, tf)}
            </SvgText>
          ))}

          {/* Mira */}
          {sel && selected !== null ? (
            <G>
              <Line x1={g.x(selected)} x2={g.x(selected)} y1={M.top} y2={g.base} stroke={colors.text} strokeWidth={0.8} strokeDasharray="3 3" />
              <Line x1={M.left} x2={M.left + g.plotW} y1={g.y(sel.close)} y2={g.y(sel.close)} stroke={colors.text} strokeWidth={0.8} strokeDasharray="3 3" />
              <Circle cx={g.x(selected)} cy={g.y(sel.close)} r={4.5} fill={colors.bg} stroke={color} strokeWidth={2} />
              <Rect x={M.left + g.plotW + 2} y={g.y(sel.close) - 8} width={M.right - 4} height={16} rx={8} fill={colors.text} />
              <SvgText x={M.left + g.plotW + 8} y={g.y(sel.close) + 3.5} fill="#050505" fontSize={10} fontFamily={fonts.monoMed}>
                {formatBrl(sel.close)}
              </SvgText>
            </G>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

/** Minigráfico de linha para listas. Reduz os pontos mantendo os extremos. */
export function Sparkline({ values, up, width = 84, height = 32 }: { values: readonly number[]; up: boolean; width?: number; height?: number }) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const v = downsample(values, 40);
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const y = scale(lo, hi === lo ? lo + 1 : hi, height - 3, 3);
  const pts = v.map((val, i) => [(i / (v.length - 1)) * (width - 2) + 1, y(val)] as [number, number]);
  const c = trendColor(up);
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path d={linePath(pts)} stroke={c} strokeWidth={5} opacity={0.14} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Path d={linePath(pts)} stroke={c} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Área do saldo/preço na Home: curva com preenchimento suave, sem eixos. */
export function AreaSpark({ values, up, height = 70 }: { values: readonly number[]; up: boolean; height?: number }) {
  const [width, setWidth] = useState(0);
  const c = trendColor(up);
  const v = downsample(values, 60);
  let body = null;
  if (width > 0 && v.length > 1) {
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    const y = scale(lo, hi === lo ? lo + 1 : hi, height - 6, 6);
    const pts = v.map((val, i) => [(i / (v.length - 1)) * width, y(val)] as [number, number]);
    body = (
      <Svg width={width} height={height} pointerEvents="none">
        <Defs>
          <LinearGradient id="home-area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c} stopOpacity="0.22" />
            <Stop offset="1" stopColor={c} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath(pts, height)} fill="url(#home-area)" />
        <Path d={linePath(pts)} stroke={c} strokeWidth={7} opacity={0.14} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Path d={linePath(pts)} stroke={c} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <View testID="home-chart" accessible accessibilityLabel="Gráfico de 24 horas" style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {body}
    </View>
  );
}

export interface CompareSeries {
  key: string;
  color: string;
  /** Variação percentual acumulada em cada ponto (começa em 0). */
  values: readonly number[];
}

/**
 * Gráfico comparativo do canvas "Mercado ao vivo": uma linha por ativo, em variação % desde o
 * início da janela, com a bolinha pulsante no último ponto e a etiqueta de valor à direita.
 */
export function CompareChart({ series, height = 232, label }: { series: readonly CompareSeries[]; height?: number; label: string }) {
  const [width, setWidth] = useState(0);
  const g = useMemo(() => {
    const x0 = 4;
    const x1 = Math.max(60, width - 76);
    const all = series.flatMap((s) => s.values);
    let lo = Math.min(0, ...all);
    let hi = Math.max(0, ...all);
    if (hi - lo < 0.5) {
      hi += 0.25;
      lo -= 0.25;
    }
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
    const y = scale(lo, hi, height - 18, 12);
    // Etiquetas à direita sem se sobrepor (mínimo de 26 px entre elas).
    const ends = series
      .map((s) => ({ s, y: y(s.values[s.values.length - 1] ?? 0) }))
      .sort((a, b) => a.y - b.y);
    const pos = ends.map((e) => e.y);
    for (let i = 1; i < pos.length; i++) if (pos[i]! - pos[i - 1]! < 26) pos[i] = pos[i - 1]! + 26;
    const over = pos.length ? pos[pos.length - 1]! - (height - 14) : 0;
    if (over > 0) for (let i = 0; i < pos.length; i++) pos[i] = pos[i]! - over;
    const labelY = new Map(ends.map((e, i) => [e.s.key, pos[i]!]));
    const grid = [0.12, 0.38, 0.64, 0.9].map((f) => ({ y: 12 + f * (height - 30), v: hi - f * (hi - lo) }));
    return { x0, x1, y, labelY, grid };
  }, [series, width, height]);

  return (
    <View testID="compare-chart" accessible accessibilityLabel={label} style={{ height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height} pointerEvents="none">
          {g.grid.map((l, i) => (
            <G key={i}>
              <Line x1={g.x0} x2={g.x1} y1={l.y} y2={l.y} stroke={GRID.stroke} strokeDasharray={GRID.dash} />
              <SvgText x={6} y={l.y - 4} {...AXIS_FONT}>
                {formatPct(l.v)}
              </SvgText>
            </G>
          ))}
          {series.map((s) => {
            const n = s.values.length;
            if (n < 2) return null;
            const x = (i: number) => g.x0 + (i * (g.x1 - g.x0)) / (n - 1);
            const pts = s.values.map((v, i) => [x(i), g.y(v)] as [number, number]);
            const last = s.values[n - 1]!;
            const ly = g.labelY.get(s.key) ?? g.y(last);
            return (
              <G key={s.key}>
                <Path d={linePath(pts)} stroke={s.color} strokeWidth={7} opacity={0.12} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <Path d={linePath(pts)} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <Circle cx={x(n - 1)} cy={g.y(last)} r={3.5} fill={s.color} />
                <Rect x={g.x1 + 8} y={ly - 11} width={66} height={22} rx={11} fill={s.color} />
                <SvgText x={g.x1 + 41} y={ly + 4} textAnchor="middle" fontFamily={fonts.monoMed} fontSize={11} fill="#050505">
                  {formatPct(last)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
