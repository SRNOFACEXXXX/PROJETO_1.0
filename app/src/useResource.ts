import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from './errors';

export type ResourceStatus = 'loading' | 'ok' | 'retrying' | 'failed';

export interface Resource<T> {
  data: T | null;
  status: ResourceStatus;
  error: string | null;
  /** Segundos até a próxima tentativa automática (só em `retrying`). */
  retryIn: number;
  /** Quando o dado atual foi obtido (ms). */
  updatedAt: number | null;
  /** O dado mostrado veio de uma carga anterior e a atual falhou/está em curso. */
  stale: boolean;
  /** "Tentar agora": zera a contagem e tenta já. */
  refresh: () => void;
}

const MAX_AUTO_RETRIES = 6;
const retryDelaySec = (attempt: number) => Math.min(60, 5 * 2 ** attempt);

/** Cache em memória: reabrir a tela mostra o último dado na hora, e a carga nova atualiza. */
const memo = new Map<string, { data: unknown; at: number }>();

/**
 * Carrega um recurso da rede sem nunca deixar a tela presa:
 *  - mostra o dado em cache imediatamente, se houver;
 *  - em caso de falha mantém o dado antigo e tenta de novo sozinho (5s, 10s, 20s, 40s, 60s, 60s);
 *  - descarta respostas de pedidos antigos (trocar de moeda/janela rápido não mistura dados);
 *  - `refreshMs` atualiza periodicamente enquanto a tela existir.
 */
export function useResource<T>(cacheKey: string, load: () => Promise<T>, refreshMs = 0): Resource<T> {
  const cached = memo.get(cacheKey) as { data: T; at: number } | undefined;
  const [data, setData] = useState<T | null>(cached?.data ?? null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(cached?.at ?? null);
  const [status, setStatus] = useState<ResourceStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState(0);

  const loadRef = useRef(load);
  loadRef.current = load;
  const token = useRef(0);
  const attempt = useRef(0);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (countdown.current) clearInterval(countdown.current);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    countdown.current = null;
    refreshTimer.current = null;
  };

  const run = useCallback(
    async (key: string) => {
      const mine = ++token.current;
      clearTimers();
      setStatus('loading');
      setError(null);
      try {
        const result = await loadRef.current();
        if (mine !== token.current) return;
        const at = Date.now();
        memo.set(key, { data: result, at });
        attempt.current = 0;
        setData(result);
        setUpdatedAt(at);
        setStatus('ok');
        if (refreshMs > 0) refreshTimer.current = setTimeout(() => void run(key), refreshMs);
      } catch (e) {
        if (mine !== token.current) return;
        setError(friendlyError(e));
        if (attempt.current >= MAX_AUTO_RETRIES) {
          setStatus('failed');
          return;
        }
        const wait = retryDelaySec(attempt.current++);
        setStatus('retrying');
        setRetryIn(wait);
        let left = wait;
        countdown.current = setInterval(() => {
          left -= 1;
          if (left <= 0) {
            clearTimers();
            void run(key);
          } else if (mine === token.current) setRetryIn(left);
        }, 1000);
      }
    },
    [refreshMs],
  );

  useEffect(() => {
    const c = memo.get(cacheKey) as { data: T; at: number } | undefined;
    setData(c?.data ?? null);
    setUpdatedAt(c?.at ?? null);
    attempt.current = 0;
    void run(cacheKey);
    return () => {
      token.current++; // invalida qualquer pedido em andamento
      clearTimers();
    };
  }, [cacheKey, run]);

  const refresh = useCallback(() => {
    attempt.current = 0;
    void run(cacheKey);
  }, [cacheKey, run]);

  return { data, status, error, retryIn, updatedAt, stale: status !== 'ok' && data !== null, refresh };
}
