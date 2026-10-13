/**
 * Regras de PIN e proteção contra força bruta (OWASP MASWE-0020 / MASWE-0021).
 * Tudo é puro e recebe o relógio por parâmetro, para ser testável.
 */

export interface PinAssessment {
  ok: boolean;
  reasons: string[];
}

const COMMON_PINS = new Set([
  '123456', '654321', '000000', '111111', '121212', '123123', '112233',
  '159753', '696969', '123321', '202020', '101010', '007007', '123654',
  '1234567', '12345678', '123456789', '0123456', '987654321',
]);

/** Avalia a força de um PIN numérico. Mínimo de 6 dígitos. */
export function assessPin(pin: string): PinAssessment {
  const reasons: string[] = [];
  if (!/^\d+$/.test(pin)) reasons.push('O PIN deve ter apenas números.');
  if (pin.length < 6) reasons.push('O PIN deve ter pelo menos 6 dígitos.');
  if (pin.length > 12) reasons.push('O PIN deve ter no máximo 12 dígitos.');
  if (/^\d+$/.test(pin) && pin.length >= 6) {
    if (new Set(pin).size === 1) reasons.push('O PIN não pode repetir o mesmo dígito.');
    if (isSequence(pin)) reasons.push('O PIN não pode ser uma sequência.');
    if (COMMON_PINS.has(pin)) reasons.push('Este PIN é muito comum.');
  }
  return { ok: reasons.length === 0, reasons };
}

function isSequence(pin: string): boolean {
  let up = true;
  let down = true;
  for (let i = 1; i < pin.length; i++) {
    const d = pin.charCodeAt(i) - pin.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
  }
  return up || down;
}

export interface PinGuardState {
  /** Falhas consecutivas desde o último acerto. */
  failures: number;
  /** Instante (ms desde a época) até o qual novas tentativas são bloqueadas. */
  lockedUntil: number;
}

export interface PinGuardPolicy {
  /** Quantas falhas são toleradas antes do primeiro bloqueio. */
  freeAttempts: number;
  baseLockMs: number;
  maxLockMs: number;
  /** Ao atingir este número de falhas consecutivas, a carteira deve ser apagada. */
  wipeAfter: number;
}

export const DEFAULT_PIN_POLICY: PinGuardPolicy = {
  freeAttempts: 4,
  baseLockMs: 30_000,
  maxLockMs: 60 * 60_000,
  wipeAfter: 10,
};

export const INITIAL_PIN_STATE: PinGuardState = { failures: 0, lockedUntil: 0 };

export function lockRemainingMs(state: PinGuardState, now: number): number {
  return Math.max(0, state.lockedUntil - now);
}

export function isLocked(state: PinGuardState, now: number): boolean {
  return lockRemainingMs(state, now) > 0;
}

export interface FailureResult {
  state: PinGuardState;
  /** true quando o limite de falhas foi atingido e os dados devem ser apagados. */
  wipe: boolean;
}

/** Registra uma tentativa errada, aplicando bloqueio exponencial. */
export function recordFailure(
  state: PinGuardState,
  now: number,
  policy: PinGuardPolicy = DEFAULT_PIN_POLICY,
): FailureResult {
  const failures = state.failures + 1;
  const over = failures - policy.freeAttempts;
  const lockMs = over > 0 ? Math.min(policy.baseLockMs * 2 ** (over - 1), policy.maxLockMs) : 0;
  return {
    state: { failures, lockedUntil: lockMs > 0 ? now + lockMs : state.lockedUntil },
    wipe: failures >= policy.wipeAfter,
  };
}

export function recordSuccess(): PinGuardState {
  return { ...INITIAL_PIN_STATE };
}
