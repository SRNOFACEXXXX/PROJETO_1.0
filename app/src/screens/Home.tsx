import {
  ExplorerError,
  GAP,
  MempoolExplorer,
  RateLimitedError,
  syncWallet,
  type DerivedAddress,
  type WalletState,
} from '@brbit/wallet-core';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { formatBtc } from '../format';
import type { Nav } from '../nav';
import { currentKeys, isFreshWallet, lockWallet, markSynced } from '../session';
import { loadCache, saveCache, type WalletCache } from '../storage';
import { colors, glow } from '../theme';
import { Banner, Body, Card, Mono, NeonButton, Screen, Title } from '../ui';

export type SyncStatus = 'loading' | 'ok' | 'retrying' | 'failed';

/** Tentativas automáticas antes de entregar o controle ao usuário. */
const MAX_AUTO_RETRIES = 6;
/** Espera entre tentativas automáticas (s): 5, 10, 20, 40, 60, 60. */
const retryDelaySec = (attempt: number) => Math.min(60, 5 * 2 ** attempt);

export function friendlyError(e: unknown): string {
  if (e instanceof RateLimitedError) return 'O servidor de blockchain está ocupado (limite de requisições).';
  if (e instanceof ExplorerError) return e.message;
  return 'Não foi possível sincronizar agora.';
}

/**
 * Estado da carteira com a rede. Regras:
 *  1. O endereço de recebimento é SEMPRE calculado no aparelho: aparece mesmo sem rede.
 *  2. Falha de rede vira nova tentativa automática, com contagem regressiva visível.
 *  3. O último saldo conhecido (cache) é mostrado, marcado como desatualizado.
 *  4. Varredura mínima: carteira nova 3 endereços, já sincronizada 5, importada 20.
 */
export function useWallet() {
  const keys = currentKeys();
  const [state, setState] = useState<WalletState | null>(null);
  const [cache, setCache] = useState<WalletCache | null>(null);
  const [status, setStatus] = useState<SyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState(0);
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);
  const running = useRef(false);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const run = useCallback(async () => {
    if (!keys || running.current) return;
    running.current = true;
    stopTimer();
    setStatus('loading');
    setError(null);
    const net = keys.network.name;
    try {
      const cached = await loadCache(net);
      if (alive.current) setCache(cached);
      const gapLimit = isFreshWallet() ? GAP.fresh : cached ? GAP.refresh : GAP.restore;
      const explorer = new MempoolExplorer(keys.network.explorerApi, fetch as never);
      const s = await syncWallet(keys, explorer, { gapLimit });
      if (!alive.current) return;
      const fresh: WalletCache = {
        confirmed: s.confirmedSats.toString(),
        pending: s.pendingSats.toString(),
        receiveIndex: s.nextReceive.index,
        changeIndex: s.nextChange.index,
        at: Date.now(),
      };
      await saveCache(net, fresh).catch(() => undefined);
      markSynced();
      attempt.current = 0;
      setState(s);
      setCache(fresh);
      setStatus('ok');
    } catch (e) {
      if (!alive.current) return;
      setError(friendlyError(e));
      if (attempt.current >= MAX_AUTO_RETRIES) {
        setStatus('failed');
      } else {
        const wait = retryDelaySec(attempt.current++);
        setStatus('retrying');
        setRetryIn(wait);
        let left = wait;
        timer.current = setInterval(() => {
          left -= 1;
          if (left <= 0) {
            stopTimer();
            running.current = false;
            void run();
          } else if (alive.current) setRetryIn(left);
        }, 1000);
      }
    } finally {
      running.current = false;
    }
  }, [keys]);

  /** "Tentar agora": zera a contagem e tenta já. */
  const refresh = useCallback(() => {
    stopTimer();
    attempt.current = 0;
    running.current = false;
    void run();
  }, [run]);

  useEffect(() => {
    alive.current = true;
    void run();
    return () => {
      alive.current = false;
      stopTimer();
    };
  }, [run]);

  // Endereço calculado localmente: não depende da rede.
  const local: DerivedAddress | null = keys ? keys.addressAt(0, state?.nextReceive.index ?? cache?.receiveIndex ?? 0) : null;
  const address = state?.nextReceive ?? local;
  const confirmed = state ? state.confirmedSats : cache ? BigInt(cache.confirmed) : null;
  const pending = state ? state.pendingSats : cache ? BigInt(cache.pending) : 0n;

  return { state, address, confirmed, pending, stale: status !== 'ok', status, error, retryIn, refresh };
}

export function SyncBanner({ status, error, retryIn }: { status: SyncStatus; error: string | null; retryIn: number }) {
  if (status === 'ok' || (status === 'loading' && !error)) return null;
  if (status === 'retrying') {
    return <Banner kind="warn">{error} Nova tentativa em {retryIn}s. Seu endereço e seus fundos continuam seguros.</Banner>;
  }
  if (status === 'failed') {
    return <Banner kind="danger">{error} Toque em "Tentar agora" quando a conexão voltar.</Banner>;
  }
  return null;
}

export function Home({ nav }: { nav: Nav }) {
  const keys = currentKeys();
  const w = useWallet();
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
        <Body muted>{w.stale && w.confirmed !== null ? 'Último saldo conhecido' : 'Saldo disponível'}</Body>
        <Text
          testID="balance"
          style={{ color: w.stale ? colors.muted : colors.text, fontSize: 36, fontWeight: '900', ...glow(colors.cyan, 0.3) }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {w.confirmed !== null ? formatBtc(w.confirmed) : w.status === 'loading' ? '…' : '—'}{' '}
          <Text style={{ fontSize: 18, color: colors.cyan }}>{unit}</Text>
        </Text>
        {w.pending > 0n ? <Body style={{ color: colors.warn, fontSize: 13 }}>+ {formatBtc(w.pending)} pendente</Body> : null}
        {w.status === 'loading' ? <Body muted style={{ fontSize: 12 }}>Sincronizando…</Body> : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <NeonButton testID="btn-receive" title="Receber" onPress={() => nav.go({ name: 'receive' })} />
        </View>
        <View style={{ flex: 1 }}>
          <NeonButton testID="btn-send" title="Enviar" variant="secondary" onPress={() => nav.go({ name: 'send' })} />
        </View>
      </View>

      <SyncBanner status={w.status} error={w.error} retryIn={w.retryIn} />
      <NeonButton
        testID="btn-refresh"
        title={w.status === 'ok' ? 'Atualizar' : 'Tentar agora'}
        variant="ghost"
        loading={w.status === 'loading'}
        onPress={w.refresh}
      />

      {w.address ? (
        <Card>
          <Body muted>Endereço de recebimento</Body>
          <Mono color={colors.lime} size={13}>{w.address.address}</Mono>
          <Body muted style={{ fontSize: 12 }}>
            {w.address.path}
            {w.state ? ` · ${w.state.utxos.length} saída(s)` : ' · calculado no aparelho'}
          </Body>
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
  const w = useWallet();
  const [copied, setCopied] = useState(false);
  const address = w.address?.address;
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
          <Body muted>Carteira bloqueada.</Body>
        )}
      </Card>
      {w.stale && address ? (
        <Banner kind="info">
          Endereço calculado no aparelho. A rede ainda não confirmou se ele já foi usado, mas ele é válido para receber.
        </Banner>
      ) : null}
      <SyncBanner status={w.status} error={w.error} retryIn={w.retryIn} />
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
