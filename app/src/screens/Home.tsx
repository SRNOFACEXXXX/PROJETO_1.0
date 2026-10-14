import { TIMEFRAMES, formatBrlFixed, formatPct, type Candle, type Ticker } from '@brbit/wallet-core';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AreaSpark, trendColor } from '../charts';
import { formatBtc, formatBtcShort } from '../format';
import { Icon, type IconName } from '../icons';
import { marketClient } from '../market';
import type { Nav } from '../nav';
import { award, levelFor, touchStreak, type Progress } from '../progress';
import { currentKeys, lockWallet } from '../session';
import { StatusBanner } from '../status';
import { colors, fonts, glow, type } from '../theme';
import { Banner, Button, CoinBadge, Header, Label, Mono, P, Pill, Screen } from '../ui';
import { useResource } from '../useResource';
import { useWallet } from '../useWallet';

const SATS = 100_000_000;

function ActionCircle({ icon, label, onPress, disabled, testID }: { icon: IconName; label: string; onPress?: () => void; disabled?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', gap: 8, opacity: disabled ? 0.4 : 1 }}
    >
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={colors.green} stroke={1.9} />
      </View>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.soft }}>{label}</Text>
    </Pressable>
  );
}

export function Home({ nav }: { nav: Nav }) {
  const keys = currentKeys();
  const w = useWallet();
  const net = keys?.network.name ?? 'testnet';
  const isMain = net === 'mainnet';
  const [prog, setProg] = useState<Progress | null>(null);
  useEffect(() => {
    touchStreak().then(setProg);
  }, []);

  const ticker = useResource<Ticker>('ticker:BTCBRL', async () => (await marketClient.getTickers(['BTCBRL']))[0]!, 30_000);
  const day = useResource<Candle[]>('candles:BTCBRL:24H', () => marketClient.getCandles('BTCBRL', TIMEFRAMES['24H']), 120_000);

  const lv = levelFor(prog?.xp ?? 0);
  const sats = w.confirmed;
  const btc = sats !== null ? Number(sats) / SATS : null;
  const price = ticker.data?.last ?? null;
  const brl = isMain && btc !== null && price !== null ? btc * price : null;
  const delta = isMain && btc !== null && ticker.data ? btc * (ticker.data.last - ticker.data.open) : null;
  const closes = day.data?.map((c) => c.close) ?? [];
  const held = isMain && btc !== null && btc > 0;
  const chartValues = held ? closes.map((c) => c * btc!) : closes;
  const up = (ticker.data?.changePct ?? 0) >= 0;
  const unit = isMain ? 'BTC' : 'tBTC';

  return (
    <Screen tab={{ active: 'home', nav }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Nível ${lv.level}`} onPress={() => nav.go({ name: 'settings' })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: colors.green }}>Nv{lv.level}</Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>Carteira Principal</Text>
            <Text style={type.monoSm}>
              {prog?.xp ?? 0}
              {lv.next ? ` / ${lv.next.from}` : ''} XP
            </Text>
          </View>
        </Pressable>
        {prog && prog.streak > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <Icon name="flame" size={14} color={colors.green} stroke={2} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.soft }}>
              {prog.streak} {prog.streak === 1 ? 'dia' : 'dias'}
            </Text>
          </View>
        ) : null}
        <Pressable
          testID="btn-lock"
          accessibilityRole="button"
          accessibilityLabel="Bloquear"
          onPress={() => {
            lockWallet();
            nav.go({ name: 'lock' });
          }}
          style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="lockClosed" size={20} color={colors.soft} />
        </Pressable>
      </View>

      <View style={{ gap: 6, paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted }}>
            {w.stale && sats !== null ? 'Último saldo conhecido' : 'Saldo total'}
          </Text>
          <Pill tone={isMain ? 'red' : 'green'} dot>
            {isMain ? 'MAINNET' : 'TESTNET'}
          </Pill>
        </View>
        {isMain ? (
          <Text testID="balance" adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 48, lineHeight: 52, letterSpacing: -1, color: w.stale ? colors.soft : colors.text }}>
            {brl !== null ? formatBrlFixed(brl) : sats !== null ? `${formatBtc(sats)} BTC` : w.status === 'loading' ? '…' : '—'}
          </Text>
        ) : (
          <Text testID="balance" adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -1, color: w.stale ? colors.soft : colors.text }}>
            {sats !== null ? formatBtc(sats) : w.status === 'loading' ? '…' : '—'} <Text style={{ fontSize: 20, color: colors.green }}>{unit}</Text>
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {isMain && ticker.data ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: up ? colors.greenFaint : colors.redFaint }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: trendColor(up) }}>
                {up ? '▲' : '▼'} {delta !== null && held ? `${delta >= 0 ? '+' : '−'}${formatBrlFixed(Math.abs(delta))} · ` : ''}
                {formatPct(ticker.data.changePct)}
              </Text>
            </View>
          ) : null}
          <Text style={{ fontFamily: fonts.bodyReg, fontSize: 12, color: colors.muted }}>
            {isMain ? (held ? 'hoje' : 'Bitcoin hoje') : 'Testnet · sem valor em reais'}
          </Text>
        </View>
        {closes.length > 1 ? <AreaSpark values={chartValues} up={up} /> : <View style={{ height: 70 }} />}
        <Text style={{ fontFamily: fonts.bodyReg, fontSize: 11, color: colors.dim }}>
          {held ? 'Seu saldo em 24 h (com o saldo atual)' : 'Preço do Bitcoin em 24 h'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ActionCircle testID="btn-send" icon="send" label="Enviar" onPress={() => nav.go({ name: 'send' })} />
        <ActionCircle testID="btn-receive" icon="receive" label="Receber" onPress={() => nav.go({ name: 'receive' })} />
        <ActionCircle icon="swap" label="Trocar" disabled />
        <ActionCircle icon="plus" label="Comprar" disabled />
      </View>

      <StatusBanner status={w.status} error={w.error} retryIn={w.retryIn} note="Seu endereço e seus fundos continuam seguros." />

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.section}>Ativos</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Ver mercado" onPress={() => nav.go({ name: 'markets' })} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.green }}>Ver mercado</Text>
          </Pressable>
        </View>
        <Pressable
          testID="asset-btc"
          accessibilityRole="button"
          accessibilityLabel="Bitcoin"
          onPress={() => nav.go({ name: 'market', symbol: 'BTCBRL' })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 68, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <CoinBadge letter="B" bg={colors.btc} ink={colors.btcInk} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>Bitcoin</Text>
            <Text style={type.monoSm}>
              {sats !== null ? formatBtcShort(sats) : '—'} {unit}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>{isMain ? (brl !== null ? formatBrlFixed(brl) : '—') : 'sem valor'}</Text>
            {ticker.data ? <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: trendColor(up) }}>{formatPct(ticker.data.changePct)}</Text> : null}
          </View>
        </Pressable>
      </View>

      <Button testID="btn-refresh" title={w.status === 'ok' ? 'Atualizar' : 'Tentar agora'} variant="ghost" loading={w.status === 'loading'} onPress={w.refresh} />
    </Screen>
  );
}

export function Receive({ nav }: { nav: Nav }) {
  const w = useWallet();
  const [copied, setCopied] = useState(false);
  const address = w.address?.address;
  const net = currentKeys()?.network.name ?? 'testnet';

  async function copy() {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    void award('firstReceive');
  }

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button testID="btn-copy" title={copied ? '✓ Copiado' : 'Copiar'} icon="copy" disabled={!address} onPress={() => void copy()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button testID="btn-share" title="Compartilhar" variant="outline" disabled={!address} onPress={() => address && void Share.share({ message: address })} />
          </View>
        </View>
      }
    >
      <Header title="Receber" onBack={() => nav.go({ name: 'home' })} />
      <View style={{ alignItems: 'center', gap: 18, paddingTop: 26, paddingBottom: 22, paddingHorizontal: 20, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        {address ? (
          <>
            <View style={[{ padding: 14, borderRadius: 20, backgroundColor: '#fff' }, glow(colors.green, 0.7)]}>
              <QRCode value={address} size={204} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Label>{net === 'mainnet' ? 'SEU ENDEREÇO BITCOIN' : 'SEU ENDEREÇO BITCOIN (TESTNET)'}</Label>
              <Mono style={{ textAlign: 'center', maxWidth: 290 }}>{address}</Mono>
            </View>
          </>
        ) : (
          <P>Carteira bloqueada.</P>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="shieldCheck" size={18} color={colors.green} />
        <Text style={{ flex: 1, fontFamily: fonts.bodyReg, fontSize: 13, lineHeight: 19, color: colors.muted }}>
          {net === 'mainnet'
            ? 'Envie apenas Bitcoin (BTC) para este endereço. Outros ativos podem ser perdidos. Cada recebimento usa um endereço novo.'
            : 'Rede de testes: envie apenas Bitcoin de testnet (tBTC) para este endereço. Cada recebimento usa um endereço novo.'}
        </Text>
      </View>

      {w.stale && address ? (
        <Banner kind="info" icon="shield">
          Endereço calculado no aparelho. A rede ainda não confirmou se ele já foi usado, mas ele é válido para receber.
        </Banner>
      ) : null}
      <StatusBanner status={w.status} error={w.error} retryIn={w.retryIn} />
    </Screen>
  );
}
