import {
  ASSETS,
  TIMEFRAMES,
  TIMEFRAME_ORDER,
  computeStats,
  formatBrl,
  formatCompact,
  formatPct,
  formatTime,
  type Asset,
  type Candle,
  type Ticker,
  type TimeframeKey,
} from '@brbit/wallet-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { CompareChart, PriceChart, Sparkline, trendColor, type ChartMode, type CompareSeries } from '../charts';
import { formatAgo } from '../format';
import { marketClient } from '../market';
import type { Nav } from '../nav';
import { StatusBanner } from '../status';
import { colors, fonts, type } from '../theme';
import { Button, CoinBadge, Header, Segmented, Screen } from '../ui';
import { useResource } from '../useResource';

const COIN_STYLE: Record<string, { bg: string; ink: string; line: string }> = {
  BTC: { bg: colors.btc, ink: colors.btcInk, line: '#F7931A' },
  ETH: { bg: '#627EEA', ink: '#fff', line: '#4DD8FF' },
  SOL: { bg: colors.sol, ink: '#fff', line: '#B27CFF' },
  BNB: { bg: '#F3BA2F', ink: '#1A1300', line: '#FFC53D' },
  XRP: { bg: '#23292F', ink: '#fff', line: '#C9CDD0' },
  ADA: { bg: '#0033AD', ink: '#fff', line: '#6B8CFF' },
  DOGE: { bg: '#C2A633', ink: '#1A1500', line: '#E8D26A' },
  LTC: { bg: '#345D9D', ink: '#fff', line: '#8FB4F0' },
};
const styleOf = (base: string) => COIN_STYLE[base] ?? { bg: colors.surface3, ink: colors.text, line: colors.soft };

/** Os 4 ativos do gráfico comparativo. */
const COMPARE = ASSETS.slice(0, 4);

function LiveDot() {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green, opacity: o }} />;
}

/** "AO VIVO" quando o dado é recente; "DESATUALIZADO há N" quando a rede falhou. */
function FreshnessPill({ updatedAt, stale }: { updatedAt: number | null; stale: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const old = updatedAt === null || stale || Date.now() - updatedAt > 90_000;
  return (
    <View
      testID="freshness"
      accessibilityLabel={old ? 'Dados desatualizados' : 'Dados ao vivo'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: old ? colors.amberLine : colors.greenLine }}
    >
      {old ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber }} /> : <LiveDot />}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.2, color: old ? colors.amber : colors.green }}>
        {old ? (updatedAt ? `DESATUALIZADO ${formatAgo(updatedAt).toUpperCase()}` : 'SEM DADOS') : 'AO VIVO'}
      </Text>
    </View>
  );
}

function TimeframePills({ tf, onPick }: { tf: TimeframeKey; onPick: (k: TimeframeKey) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {TIMEFRAME_ORDER.map((k) => {
        const on = k === tf;
        return (
          <Pressable
            key={k}
            testID={`tf-${k}`}
            accessibilityRole="button"
            accessibilityLabel={`Janela ${TIMEFRAMES[k].label}`}
            accessibilityState={{ selected: on }}
            onPress={() => onPick(k)}
            style={{ flex: 1, minHeight: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.green : 'transparent' }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: on ? colors.greenInk : colors.muted }}>{TIMEFRAMES[k].label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChangePill({ pct, suffix }: { pct: number; suffix?: string }) {
  const up = pct >= 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: up ? colors.greenFaint : colors.redFaint }}>
        <Text testID="change-pill" style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: trendColor(up) }}>
          {up ? '▲' : '▼'} {formatPct(pct)}
        </Text>
      </View>
      {suffix ? <Text style={{ fontFamily: fonts.bodyReg, fontSize: 12, color: colors.muted }}>{suffix}</Text> : null}
    </View>
  );
}

function pctSeries(candles: readonly Candle[]): number[] {
  const base = candles[0]!.open;
  return candles.map((c) => (c.close / base - 1) * 100);
}

// ───────────────────────── Aba Mercado ─────────────────────────

function AssetRow({ asset, ticker, spark, onPress }: { asset: Asset; ticker: Ticker | undefined; spark: readonly number[]; onPress: () => void }) {
  const st = styleOf(asset.base);
  const up = (ticker?.changePct ?? 0) >= 0;
  return (
    <Pressable
      testID={`market-row-${asset.base}`}
      accessibilityRole="button"
      accessibilityLabel={ticker ? `${asset.name}, ${formatBrl(ticker.last)}, ${up ? 'alta' : 'queda'} de ${formatPct(Math.abs(ticker.changePct))} em 24 horas` : asset.name}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 68, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <CoinBadge letter={asset.base.slice(0, 1)} bg={st.bg} ink={st.ink} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>{asset.name}</Text>
        <Text style={type.monoSm}>{asset.base}</Text>
      </View>
      <Sparkline values={spark} up={up} />
      <View style={{ alignItems: 'flex-end', minWidth: 88 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }}>{ticker ? formatBrl(ticker.last) : '—'}</Text>
        {ticker ? <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: trendColor(up) }}>{formatPct(ticker.changePct)}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Markets({ nav }: { nav: Nav }) {
  const [tf, setTf] = useState<TimeframeKey>('24H');
  const [off, setOff] = useState<Record<string, boolean>>({});

  // Um recurso por ativo do comparativo (quantidade fixa: respeita as regras dos hooks).
  const cmp = COMPARE.map((a) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useResource<Candle[]>(`candles:${a.symbol}:${tf}`, () => marketClient.getCandles(a.symbol, TIMEFRAMES[tf]), tf === '24H' ? 60_000 : 300_000),
  );
  const tickers = useResource<Ticker[]>('tickers:all', () => marketClient.getTickers(ASSETS.map((a) => a.symbol)), 30_000);
  const sparks = ASSETS.map((a) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useResource<Candle[]>(`candles:${a.symbol}:24H`, () => marketClient.getCandles(a.symbol, TIMEFRAMES['24H']), 300_000),
  );

  const series: CompareSeries[] = COMPARE.flatMap((a, i) => {
    const d = cmp[i]!.data;
    if (!d || off[a.base]) return [];
    return [{ key: a.base, color: styleOf(a.base).line, values: pctSeries(d) }];
  });

  const btc = cmp[0]!.data;
  const btcStats = btc ? computeStats(btc) : null;
  const firstError = [...cmp, tickers].find((r) => r.status === 'retrying' || r.status === 'failed');
  const updated = Math.max(0, ...[tickers.updatedAt, ...cmp.map((r) => r.updatedAt)].map((v) => v ?? 0)) || null;
  const anyStale = [...cmp, tickers].some((r) => r.stale);
  const label = series.length
    ? `Comparativo de variação em ${TIMEFRAMES[tf].label}: ${series.map((s) => `${s.key} ${formatPct(s.values[s.values.length - 1]!)}`).join(', ')}`
    : 'Gráfico comparativo sem dados';

  return (
    <Screen tab={{ active: 'market', nav }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.4, color: colors.text }}>Mercado</Text>
        <FreshnessPill updatedAt={updated} stale={anyStale && !!firstError} />
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted }}>Bitcoin · BTC</Text>
        <Text testID="headline-price" style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.8, color: colors.text }}>
          {btcStats ? formatBrl(btcStats.last) : '…'}
        </Text>
        {btcStats ? <ChangePill pct={btcStats.changePct} suffix="no período" /> : null}
      </View>

      {firstError ? <StatusBanner status={firstError.status} error={firstError.error} retryIn={firstError.retryIn} note="Mostrando os últimos dados." /> : null}

      <CompareChart series={series} label={label} />
      <TimeframePills tf={tf} onPick={setTf} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {COMPARE.map((a, i) => {
          const d = cmp[i]!.data;
          const pct = d ? computeStats(d).changePct : null;
          const on = !off[a.base];
          return (
            <Pressable
              key={a.base}
              testID={`legend-${a.base}`}
              accessibilityRole="button"
              accessibilityLabel={`${a.name}${pct !== null ? `, ${formatPct(pct)}` : ''}`}
              accessibilityState={{ selected: on }}
              onPress={() => setOff((o) => ({ ...o, [a.base]: on }))}
              style={{ width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: on ? colors.borderStrong : 'rgba(255,255,255,0.06)', opacity: on ? 1 : 0.45 }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: styleOf(a.base).line }} />
              <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text }}>{a.base}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: pct === null ? colors.muted : trendColor(pct >= 0) }}>{pct === null ? '—' : formatPct(pct)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[type.section, { marginTop: 6 }]}>Ativos</Text>
      <View style={{ gap: 10 }}>
        {ASSETS.map((a, i) => (
          <AssetRow
            key={a.symbol}
            asset={a}
            ticker={tickers.data?.find((t) => t.symbol === a.symbol)}
            spark={sparks[i]!.data?.map((c) => c.close) ?? []}
            onPress={() => nav.go({ name: 'market', symbol: a.symbol })}
          />
        ))}
      </View>

      {firstError ? <Button testID="btn-market-retry" title="Tentar agora" variant="ghost" onPress={() => [...cmp, tickers, ...sparks].forEach((r) => r.refresh())} /> : null}
      <Text style={{ fontFamily: fonts.bodyReg, fontSize: 11, lineHeight: 16, color: colors.dim }}>
        Preços em R$ de dados públicos da Binance. Nenhum dado da sua carteira é enviado. Isto não é recomendação de investimento.
      </Text>
    </Screen>
  );
}

// ───────────────────────── Detalhe do ativo ─────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '48.5%', gap: 4, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Text style={type.label}>{label}</Text>
      <Text style={{ fontFamily: fonts.monoMed, fontSize: 14, color: colors.text }}>{value}</Text>
    </View>
  );
}

export function MarketDetail({ nav, symbol }: { nav: Nav; symbol: string }) {
  const asset = ASSETS.find((a) => a.symbol === symbol) ?? ASSETS[0]!;
  const [tf, setTf] = useState<TimeframeKey>('7D');
  const [mode, setMode] = useState<ChartMode>('line');
  const [selected, setSelected] = useState<number | null>(null);

  const candles = useResource<Candle[]>(`candles:${asset.symbol}:${tf}`, () => marketClient.getCandles(asset.symbol, TIMEFRAMES[tf]), tf === '24H' ? 60_000 : 300_000);
  const ticker = useResource<Ticker>(`ticker:${asset.symbol}`, async () => (await marketClient.getTickers([asset.symbol]))[0]!, 30_000);

  useEffect(() => setSelected(null), [tf, asset.symbol]);

  const data = candles.data;
  const stats = useMemo(() => (data ? computeStats(data) : null), [data]);
  const sel = data && selected !== null ? data[selected] : undefined;
  const price = sel ? sel.close : (ticker.data?.last ?? stats?.last ?? null);
  const pct = sel && data ? (sel.close / data[0]!.open - 1) * 100 : (stats?.changePct ?? null);
  const label = stats && data
    ? `${asset.name}, janela ${TIMEFRAMES[tf].label}: de ${formatBrl(stats.first)} a ${formatBrl(stats.last)}, ${formatPct(stats.changePct)}.` +
      (sel ? ` Vela de ${formatTime(sel.time, tf)}: abertura ${formatBrl(sel.open)}, máxima ${formatBrl(sel.high)}, mínima ${formatBrl(sel.low)}, fechamento ${formatBrl(sel.close)}.` : '')
    : 'Carregando gráfico';

  return (
    <Screen>
      <Header title={asset.name} onBack={() => nav.go({ name: 'markets' })} right={<FreshnessPill updatedAt={candles.updatedAt} stale={candles.stale} />} />

      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted }}>
          {asset.name} · {asset.base}
          {sel && data ? ` · ${formatTime(sel.time, tf)}` : ''}
        </Text>
        <Text testID="detail-price" style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.8, color: colors.text }}>
          {price !== null ? formatBrl(price) : '…'}
        </Text>
        {pct !== null ? <ChangePill pct={pct} suffix={sel ? 'desde o início da janela' : `em ${TIMEFRAMES[tf].label}`} /> : null}
      </View>

      <StatusBanner status={candles.status} error={candles.error} retryIn={candles.retryIn} note={data ? 'Mostrando os últimos dados.' : undefined} />

      {data && data.length > 0 ? (
        <PriceChart candles={data} tf={tf} mode={mode} selected={selected} onSelect={setSelected} label={label} />
      ) : (
        <View style={{ height: 300, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyReg, color: colors.muted }}>{candles.status === 'loading' ? 'Carregando gráfico…' : 'Sem dados para mostrar.'}</Text>
        </View>
      )}

      <TimeframePills tf={tf} onPick={setTf} />
      <Segmented
        options={[
          { key: 'line', label: 'Linha' },
          { key: 'candles', label: 'Velas' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {sel ? (
        <View testID="candle-info" style={{ gap: 6, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={type.label}>VELA · {formatTime(sel.time, tf)}</Text>
            <Pressable testID="btn-clear-selection" accessibilityRole="button" accessibilityLabel="Limpar seleção" onPress={() => setSelected(null)} hitSlop={10}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.green }}>Limpar</Text>
            </Pressable>
          </View>
          <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.text }}>
            A {formatBrl(sel.open)} · M {formatBrl(sel.high)} · m {formatBrl(sel.low)} · F {formatBrl(sel.close)}
          </Text>
          <Text style={type.monoSm}>Volume {formatCompact(sel.volume)} {asset.base}</Text>
        </View>
      ) : (
        <Text style={{ fontFamily: fonts.bodyReg, fontSize: 12, color: colors.dim, textAlign: 'center' }}>Toque ou arraste no gráfico para ver cada vela.</Text>
      )}

      {stats ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Stat label="MÁXIMA" value={formatBrl(stats.high)} />
          <Stat label="MÍNIMA" value={formatBrl(stats.low)} />
          <Stat label="ABERTURA" value={formatBrl(stats.first)} />
          <Stat label={`VOLUME (${asset.base})`} value={formatCompact(stats.volume)} />
        </View>
      ) : null}

      {candles.status !== 'ok' ? <Button testID="btn-detail-retry" title="Tentar agora" variant="ghost" onPress={() => { candles.refresh(); ticker.refresh(); }} /> : null}
      <Text style={{ fontFamily: fonts.bodyReg, fontSize: 11, lineHeight: 16, color: colors.dim }}>
        Preços em R$ de dados públicos da Binance. Nenhum dado da sua carteira é enviado. Isto não é recomendação de investimento.
      </Text>
    </Screen>
  );
}
