import { MempoolExplorer, NETWORKS, syncWallet, type WalletState } from '@brbit/wallet-core';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { formatBtc } from '../format';
import type { Nav } from '../nav';
import { currentKeys, lockWallet } from '../session';
import { colors, glow } from '../theme';
import { Banner, Body, Card, Mono, NeonButton, Screen, Title } from '../ui';

export function useWallet() {
  const [state, setState] = useState<WalletState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const keys = currentKeys();
    if (!keys) return;
    setLoading(true);
    setError(null);
    try {
      const explorer = new MempoolExplorer(keys.network.explorerApi, fetch as never);
      setState(await syncWallet(keys, explorer));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao sincronizar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, error, loading, refresh };
}

export function Home({ nav }: { nav: Nav }) {
  const keys = currentKeys();
  const { state, error, loading, refresh } = useWallet();
  const net = keys?.network.name ?? 'testnet';
  const unit = net === 'testnet' ? 'tBTC' : 'BTC';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.cyan, letterSpacing: 6, fontWeight: '800' }}>BR BIT</Text>
        <View
          style={{
            borderColor: net === 'mainnet' ? colors.danger : colors.lime,
            borderWidth: 1,
            borderRadius: 99,
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: net === 'mainnet' ? colors.danger : colors.lime, fontSize: 12, fontWeight: '800' }}>
            {net === 'mainnet' ? 'MAINNET' : 'TESTNET'}
          </Text>
        </View>
      </View>

      <Card accent={colors.cyan} style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Body muted>Saldo disponível</Body>
        <Text
          testID="balance"
          style={{ color: colors.text, fontSize: 36, fontWeight: '900', ...glow(colors.cyan, 0.3) }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {state ? formatBtc(state.confirmedSats) : loading ? '…' : '—'} <Text style={{ fontSize: 18, color: colors.cyan }}>{unit}</Text>
        </Text>
        {state && state.pendingSats > 0n ? (
          <Body style={{ color: colors.warn, fontSize: 13 }}>+ {formatBtc(state.pendingSats)} pendente</Body>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <NeonButton testID="btn-receive" title="Receber" onPress={() => nav.go({ name: 'receive' })} />
        </View>
        <View style={{ flex: 1 }}>
          <NeonButton testID="btn-send" title="Enviar" variant="secondary" onPress={() => nav.go({ name: 'send' })} />
        </View>
      </View>

      {error ? <Banner kind="danger">{error}</Banner> : null}
      <NeonButton testID="btn-refresh" title="Atualizar" variant="ghost" loading={loading} onPress={refresh} />

      {state ? (
        <Card>
          <Body muted>Próximo endereço de recebimento</Body>
          <Mono color={colors.lime} size={13}>{state.nextReceive.address}</Mono>
          <Body muted style={{ fontSize: 12 }}>{state.nextReceive.path} · {state.utxos.length} saída(s)</Body>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <NeonButton testID="btn-settings" title="Ajustes" variant="ghost" onPress={() => nav.go({ name: 'settings' })} />
        </View>
        <View style={{ flex: 1 }}>
          <NeonButton
            testID="btn-lock"
            title="Bloquear"
            variant="ghost"
            onPress={() => {
              lockWallet();
              nav.go({ name: 'lock' });
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

export function Receive({ nav }: { nav: Nav }) {
  const { state, error, loading } = useWallet();
  const [copied, setCopied] = useState(false);
  const address = state?.nextReceive.address;
  return (
    <Screen>
      <Title>Receber</Title>
      <Body muted>Cada recebimento usa um endereço novo, para proteger sua privacidade.</Body>
      <Card accent={colors.lime} style={{ alignItems: 'center', gap: 16 }}>
        {address ? (
          <>
            <View style={{ backgroundColor: '#fff', padding: 14, borderRadius: 16 }}>
              <QRCode value={address.toUpperCase()} size={200} />
            </View>
            <Mono color={colors.lime} size={13}>{address}</Mono>
          </>
        ) : (
          <Body muted>{loading ? 'Gerando endereço…' : 'Endereço indisponível.'}</Body>
        )}
      </Card>
      {error ? <Banner kind="danger">{error}</Banner> : null}
      <NeonButton
        testID="btn-copy"
        title={copied ? '✓ Copiado' : 'Copiar endereço'}
        disabled={!address}
        onPress={async () => {
          if (!address) return;
          await Clipboard.setStringAsync(address);
          setCopied(true);
        }}
      />
      <NeonButton title="Voltar" variant="ghost" onPress={() => nav.go({ name: 'home' })} />
    </Screen>
  );
}
