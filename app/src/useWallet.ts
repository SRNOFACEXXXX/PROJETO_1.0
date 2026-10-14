import { GAP, syncWallet, type DerivedAddress, type WalletState } from '@brbit/wallet-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from './errors';
import { explorerFor } from './explorer';
import { currentKeys, isFreshWallet, markSynced } from './session';
import { loadCache, saveCache, type WalletCache } from './storage';

export type SyncStatus = 'loading' | 'ok' | 'retrying' | 'failed';

/** Tentativas automáticas antes de entregar o controle ao usuário. */
const MAX_AUTO_RETRIES = 6;
/** Espera entre tentativas automáticas (s): 5, 10, 20, 40, 60, 60. */
const retryDelaySec = (attempt: number) => Math.min(60, 5 * 2 ** attempt);

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
      const s = await syncWallet(keys, explorerFor(keys), { gapLimit });
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
  const address: DerivedAddress | null = state?.nextReceive ?? (keys ? keys.addressAt(0, cache?.receiveIndex ?? 0) : null);
  const confirmed = state ? state.confirmedSats : cache ? BigInt(cache.confirmed) : null;
  const pending = state ? state.pendingSats : cache ? BigInt(cache.pending) : 0n;

  return { state, address, confirmed, pending, stale: status !== 'ok', status, error, retryIn, refresh };
}
