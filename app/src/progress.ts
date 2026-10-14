import { XP_TABLE, dayKey, nextStreak } from '@brbit/wallet-core';
import * as SecureStore from 'expo-secure-store';

// As regras (níveis, tabela de XP, sequência) são puras e testadas em wallet-core/levels.
export { LEVELS, XP_TABLE, levelFor } from '@brbit/wallet-core';

/**
 * Progresso do usuário (nível, XP e sequência de dias). Tudo local, só números e datas:
 * nada aqui identifica a carteira, e nada daqui dá acesso a fundos.
 */
export interface Progress {
  xp: number;
  /** Conquistas já pontuadas (cada uma só vale uma vez). */
  done: string[];
  streak: number;
  /** Último dia em que o app foi aberto, AAAA-MM-DD (fuso local). */
  lastDay: string | null;
}

const KEY = 'brbit.progress.v1';
const EMPTY: Progress = { xp: 0, done: [], streak: 0, lastDay: null };

export async function loadProgress(): Promise<Progress> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return { ...EMPTY };
  try {
    const p = JSON.parse(raw) as Partial<Progress>;
    if (Number.isInteger(p.xp) && p.xp! >= 0 && Array.isArray(p.done) && Number.isInteger(p.streak)) {
      return { xp: p.xp!, done: p.done.filter((x) => typeof x === 'string'), streak: p.streak!, lastDay: typeof p.lastDay === 'string' ? p.lastDay : null };
    }
  } catch {
    // arquivo corrompido: recomeça (é só conveniência)
  }
  return { ...EMPTY };
}

async function save(p: Progress): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(p));
}

/** Pontua uma conquista uma única vez. Devolve o progresso novo e quantos XP ganhou agora. */
export async function award(key: keyof typeof XP_TABLE): Promise<{ progress: Progress; gained: number }> {
  const p = await loadProgress();
  if (p.done.includes(key)) return { progress: p, gained: 0 };
  const gained = XP_TABLE[key]!.xp;
  const next = { ...p, xp: p.xp + gained, done: [...p.done, key] };
  await save(next);
  return { progress: next, gained };
}

/** Marca que o app foi aberto hoje e atualiza a sequência de dias seguidos. */
export async function touchStreak(now = new Date()): Promise<Progress> {
  const p = await loadProgress();
  const today = dayKey(now);
  if (p.lastDay === today) return p;
  const next = { ...p, streak: nextStreak(p.streak, p.lastDay, today), lastDay: today };
  await save(next);
  return next;
}

export async function resetProgress(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
