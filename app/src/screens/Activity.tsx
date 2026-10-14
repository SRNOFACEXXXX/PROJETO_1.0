import { buildActivity, dayLabel, formatTime, type ActivityItem } from '@brbit/wallet-core';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { explorerFor } from '../explorer';
import { formatBtcShort } from '../format';
import { Icon } from '../icons';
import type { Nav } from '../nav';
import { currentKeys } from '../session';
import { StatusBanner } from '../status';
import { colors, fonts, type } from '../theme';
import { Banner, Button, Header, P, Screen } from '../ui';
import { useResource } from '../useResource';
import { useWallet } from '../useWallet';

type Filter = 'all' | 'sent' | 'received';
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Tudo' },
  { key: 'sent', label: 'Enviado' },
  { key: 'received', label: 'Recebido' },
];

/** Máximo de endereços consultados para montar o histórico (cada um é uma consulta ao servidor). */
const MAX_ADDRESSES = 12;

function Row({ item, unit }: { item: ActivityItem; unit: string }) {
  const received = item.kind === 'received';
  const title = item.kind === 'received' ? 'Recebido' : item.kind === 'sent' ? 'Enviado' : 'Consolidação';
  const sign = received ? '+' : '−';
  const status = !item.confirmed
    ? null
    : `Confirmada · ${item.confirmations >= 6 ? '6+' : item.confirmations} conf.${item.time ? ` · ${formatTime(item.time, '24H')}` : ''}`;
  return (
    <View
      testID={`activity-${item.kind}`}
      accessible
      accessibilityLabel={`${title}, ${sign}${formatBtcShort(item.amountSats)} ${unit}, ${item.confirmed ? 'confirmada' : 'pendente'}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 72, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={received ? 'receive' : item.kind === 'sent' ? 'send' : 'swap'} size={20} color={received ? colors.green : colors.text} stroke={1.9} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>
          {title} · BTC
        </Text>
        {status ? (
          <Text style={{ fontFamily: fonts.bodyReg, fontSize: 12, color: colors.muted }}>{status}</Text>
        ) : (
          <View style={{ alignSelf: 'flex-start', height: 22, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, borderColor: colors.amberLine, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.6, color: colors.amber }}>PENDENTE</Text>
          </View>
        )}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.monoMed, fontSize: 14, color: received ? colors.green : colors.text }}>
          {sign}
          {formatBtcShort(item.amountSats)}
        </Text>
        <Text style={type.monoSm}>{item.kind === 'sent' ? `taxa ${formatBtcShort(item.feeSats)}` : unit}</Text>
      </View>
    </View>
  );
}

export function Activity({ nav }: { nav: Nav }) {
  const keys = currentKeys();
  const w = useWallet();
  const [filter, setFilter] = useState<Filter>('all');
  const used = w.state?.usedAddresses ?? [];
  const unit = keys?.network.name === 'mainnet' ? 'BTC' : 'tBTC';

  const own = useMemo(() => {
    const s = new Set(used.map((a) => a.address));
    if (w.state) {
      s.add(w.state.nextReceive.address);
      s.add(w.state.nextChange.address);
    }
    return s;
  }, [w.state]);

  const key = `activity:${keys?.network.name}:${used.map((a) => a.address).join(',')}:${w.state ? 'ok' : 'wait'}`;
  const res = useResource<ActivityItem[] | null>(
    key,
    async () => {
      if (!keys || !w.state) return null;
      if (used.length === 0) return [];
      const ex = explorerFor(keys);
      const [lists, tip] = await Promise.all([Promise.all(used.slice(0, MAX_ADDRESSES).map((a) => ex.getAddressTxs(a.address))), ex.getTipHeight()]);
      return buildActivity(lists.flat(), own, tip);
    },
    60_000,
  );

  const items = (res.data ?? []).filter((i) => filter === 'all' || (filter === 'sent' ? i.kind !== 'received' : i.kind === 'received'));
  const now = Date.now();
  const tz = -new Date().getTimezoneOffset();
  const groups = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const i of items) {
      const k = dayLabel(i.time, now, tz);
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return [...map.entries()];
  }, [items.length, filter, res.updatedAt]);

  const waiting = !w.state && w.status !== 'ok';
  const loading = res.status === 'loading' && res.data === null;

  return (
    <Screen tab={{ active: 'activity', nav }}>
      <Header title="Atividade" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              testID={`filter-${f.key}`}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(f.key)}
              style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 0 : 1, borderColor: colors.borderMid, backgroundColor: on ? colors.green : 'transparent' }}
            >
              <Text style={{ fontFamily: on ? fonts.bodyBold : fonts.bodySemi, fontSize: 13, color: on ? colors.greenInk : colors.soft }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {waiting ? <StatusBanner status={w.status} error={w.error} retryIn={w.retryIn} /> : null}
      {!waiting ? <StatusBanner status={res.status} error={res.error} retryIn={res.retryIn} note="Mostrando o último histórico carregado." /> : null}

      {loading || (waiting && w.status === 'loading') ? <P>Carregando atividade…</P> : null}

      {!loading && !waiting && res.data && items.length === 0 ? (
        <View testID="activity-empty" style={{ alignItems: 'center', gap: 8, paddingVertical: 36 }}>
          <Icon name="list" size={32} color={colors.dim} />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text }}>Nenhuma atividade ainda</Text>
          <P small style={{ textAlign: 'center', maxWidth: 260 }}>
            {filter === 'all' ? 'Suas transações aparecerão aqui assim que a carteira enviar ou receber.' : 'Nenhuma transação neste filtro.'}
          </P>
        </View>
      ) : null}

      {groups.map(([day, list]) => (
        <View key={day} style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.2, color: colors.muted, marginTop: 4 }}>{day}</Text>
          {list.map((i) => (
            <Row key={i.txid} item={i} unit={unit} />
          ))}
        </View>
      ))}

      {w.status !== 'ok' || res.status === 'failed' ? <Button testID="btn-activity-retry" title="Tentar agora" variant="ghost" onPress={() => { w.refresh(); res.refresh(); }} /> : null}
      {res.stale ? <Banner kind="info" icon="shield">Dados anteriores; atualizando quando o servidor responder.</Banner> : null}
    </Screen>
  );
}
