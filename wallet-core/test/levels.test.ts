import { describe, expect, it } from 'vitest';
import { LEVELS, XP_TABLE, dayKey, daysBetween, levelFor, nextStreak } from '../src/index.js';

describe('levelFor', () => {
  it.each([
    [0, 1, 'Guardião'],
    [150, 1, 'Guardião'],
    [299, 1, 'Guardião'],
    [300, 2, 'Explorador'],
    [799, 2, 'Explorador'],
    [800, 3, 'Navegador'],
    [1500, 4, 'Estrategista'],
    [2500, 5, 'Veterano'],
    [4000, 6, 'Mestre'],
    [1_000_000, 6, 'Mestre'],
  ])('%s XP -> nível %s (%s)', (xp, level, name) => {
    expect(levelFor(xp)).toMatchObject({ level, name });
  });

  it('calcula quanto falta e o progresso dentro do nível', () => {
    const l = levelFor(150);
    expect(l.next?.level).toBe(2);
    expect(l.toNext).toBe(150);
    expect(l.into).toBe(150);
    expect(l.span).toBe(300);
    expect(l.into / l.span).toBeCloseTo(0.5, 5);
  });

  it('no último nível não há próximo e não divide por zero', () => {
    const l = levelFor(9999);
    expect(l.next).toBeNull();
    expect(l.toNext).toBe(0);
    expect(l.span).toBe(1);
  });

  it('entradas inválidas viram nível 1 (nunca quebram a tela)', () => {
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(levelFor(bad).level).toBe(1);
    }
  });

  it('a tabela de níveis é crescente e começa em zero', () => {
    expect(LEVELS[0].from).toBe(0);
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i]!.from).toBeGreaterThan(LEVELS[i - 1]!.from);
  });

  it('o backup e o PIN somam os 150 XP mostrados na tela "Carteira criada"', () => {
    expect(XP_TABLE.backup!.xp + XP_TABLE.pin!.xp).toBe(150);
  });
});

describe('dias e sequência', () => {
  it('dayKey usa o fuso local e 2 dígitos', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });

  it('daysBetween atravessa mês, ano e bissexto', () => {
    expect(daysBetween('2026-10-12', '2026-10-13')).toBe(1);
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2); // 2028 é bissexto
    expect(daysBetween('2026-10-13', '2026-10-13')).toBe(0);
    expect(daysBetween('2026-10-13', '2026-10-10')).toBe(-3);
  });

  it('nextStreak: primeira vez, mesmo dia, dia seguinte, falha e relógio voltando', () => {
    expect(nextStreak(0, null, '2026-10-13')).toBe(1);
    expect(nextStreak(4, '2026-10-13', '2026-10-13')).toBe(4);
    expect(nextStreak(4, '2026-10-12', '2026-10-13')).toBe(5);
    expect(nextStreak(4, '2026-10-11', '2026-10-13')).toBe(1);
    expect(nextStreak(4, '2026-10-20', '2026-10-13')).toBe(1);
  });

  it('uma semana seguida soma 7', () => {
    let s = 0;
    let last: string | null = null;
    for (let d = 1; d <= 7; d++) {
      const today = `2026-10-${String(d).padStart(2, '0')}`;
      s = nextStreak(s, last, today);
      last = today;
    }
    expect(s).toBe(7);
  });
});
