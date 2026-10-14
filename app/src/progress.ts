import * as SecureStore from 'expo-secure-store';

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

export const LEVELS = [
  { level: 1, name: 'Guardião', from: 0 },
  { level: 2, name: 'Explorador', from: 300 },
  { level: 3, name: 'Navegador', from: 800 },
  { level: 4, name: 'Estrategista', from: 1500 },
  { level: 5, name: 'Veterano', from: 2500 },
  { level: 6, name: 'Mestre', from: 4000 },
] as const;

/** Pontos de cada conquista. */
export const XP_TABLE: Record<string, { xp: number; title: string }> = {
  backup: { xp: 100, title: 'Backup confirmado' },
  pin: { xp: 50, title: 'PIN criado' },
  biometric: { xp: 50, title: 'Biometria ativada' },
  firstReceive: { xp: 50, title: 'Primeiro endereço copiado' },
  firstSend: { xp: 100, title: 'Primeiro envio' },
  viewedKey: { xp: 30, title: 'Chave de segurança revista' },
};

const KEY = 'brbit.progress.v1';
const EMPTY: Progress = { xp: 0, done: [], streak: 0, lastDay: null };

export function levelFor(xp: number) {
  let cur: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.from) cur = l;
  const next = LEVELS.find((l) => l.from > xp) ?? null;
  return { ...cur, next, toNext: next ? next.from - xp : 0, into: xp - cur.from, span: next ? next.from - cur.from : 1 };
}

/** AAAA-MM-DD no fuso local. */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

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
  const gap = p.lastDay ? daysBetween(p.lastDay, today) : null;
  const streak = gap === 1 ? p.streak + 1 : 1;
  const next = { ...p, streak, lastDay: today };
  await save(next);
  return next;
}

export async function resetProgress(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
