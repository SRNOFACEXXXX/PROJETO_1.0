/** Satoshis (bigint) → "0,00012345". Sem ponto flutuante: valores em dinheiro nunca usam number. */
export function formatBtc(sats: bigint): string {
  const neg = sats < 0n;
  const abs = neg ? -sats : sats;
  const whole = abs / 100_000_000n;
  const frac = (abs % 100_000_000n).toString().padStart(8, '0');
  return `${neg ? '-' : ''}${whole},${frac}`;
}

/** Versão curta para listas: tira zeros à direita, mantendo ao menos 2 casas ("0,00412"). */
export function formatBtcShort(sats: bigint): string {
  const [w, f = ''] = formatBtc(sats).split(',');
  const trimmed = f.replace(/0+$/, '').padEnd(2, '0');
  return `${w},${trimmed}`;
}

/** "0,001" ou "0.001" → 100000n. Devolve null se inválido ou com mais de 8 casas. */
export function parseBtcToSats(input: string): bigint | null {
  const t = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,8})?$/.test(t)) return null;
  const [w = '0', f = ''] = t.split('.');
  const sats = BigInt(w) * 100_000_000n + BigInt(f.padEnd(8, '0'));
  return sats > 0n && sats <= 21_000_000n * 100_000_000n ? sats : null;
}

export function shortAddress(a: string): string {
  return a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a;
}

export function formatDuration(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}min ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}min`;
}

/** "há 5 s", "há 3 min", "há 2 h". */
export function formatAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  return `há ${Math.floor(s / 3600)} h`;
}
