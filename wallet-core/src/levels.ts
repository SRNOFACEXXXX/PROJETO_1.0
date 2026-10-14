/** Níveis, pontos (XP) e sequência de dias: regras puras, sem armazenamento. */

export const LEVELS = [
  { level: 1, name: 'Guardião', from: 0 },
  { level: 2, name: 'Explorador', from: 300 },
  { level: 3, name: 'Navegador', from: 800 },
  { level: 4, name: 'Estrategista', from: 1500 },
  { level: 5, name: 'Veterano', from: 2500 },
  { level: 6, name: 'Mestre', from: 4000 },
] as const;

/** Pontos de cada conquista. Cada uma só vale uma vez. */
export const XP_TABLE: Readonly<Record<string, { xp: number; title: string }>> = {
  backup: { xp: 100, title: 'Backup confirmado' },
  pin: { xp: 50, title: 'PIN criado' },
  biometric: { xp: 50, title: 'Biometria ativada' },
  firstReceive: { xp: 50, title: 'Primeiro endereço copiado' },
  firstSend: { xp: 100, title: 'Primeiro envio' },
  viewedKey: { xp: 30, title: 'Chave de segurança revista' },
};

export interface LevelInfo {
  level: number;
  name: string;
  from: number;
  /** Próximo nível, ou null no último. */
  next: (typeof LEVELS)[number] | null;
  /** XP que faltam para o próximo nível (0 no último). */
  toNext: number;
  /** XP já acumulados dentro do nível atual. */
  into: number;
  /** Tamanho do nível atual em XP (1 no último, para não dividir por zero). */
  span: number;
}

export function levelFor(xp: number): LevelInfo {
  const safe = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  let cur: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (safe >= l.from) cur = l;
  const next = LEVELS.find((l) => l.from > safe) ?? null;
  return { ...cur, next, toNext: next ? next.from - safe : 0, into: safe - cur.from, span: next ? next.from - cur.from : 1 };
}

/** AAAA-MM-DD no fuso local. */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Dias de calendário entre duas datas AAAA-MM-DD (b - a), imune a horário de verão. */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/**
 * Nova sequência ao abrir o app em `today`: o mesmo dia mantém; o dia seguinte soma 1;
 * qualquer outra coisa (pulou um dia, primeira vez, relógio voltou) recomeça em 1.
 */
export function nextStreak(streak: number, lastDay: string | null, today: string): number {
  if (lastDay === today) return streak;
  return lastDay !== null && daysBetween(lastDay, today) === 1 ? streak + 1 : 1;
}
