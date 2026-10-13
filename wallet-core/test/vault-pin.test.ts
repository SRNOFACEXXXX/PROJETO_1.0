import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIN_POLICY,
  INITIAL_PIN_STATE,
  WrongPinError,
  assessPin,
  isLocked,
  lockRemainingMs,
  openSecret,
  recordFailure,
  recordSuccess,
  sealSecret,
} from '../src/index.js';

const FAST = { N: 2 ** 10, r: 8, p: 1 };
const SECRET = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('cofre criptografado', () => {
  it('abre com o PIN correto', () => {
    expect(openSecret(sealSecret(SECRET, '482916', FAST), '482916')).toBe(SECRET);
  });

  it('falha com PIN errado', () => {
    expect(() => openSecret(sealSecret(SECRET, '482916', FAST), '482917')).toThrow(WrongPinError);
  });

  it('o texto da seed não aparece no cofre', () => {
    const sealed = sealSecret(SECRET, '482916', FAST);
    expect(sealed).not.toContain('abandon');
  });

  it('usa sal e nonce novos a cada vez', () => {
    expect(sealSecret(SECRET, '482916', FAST)).not.toBe(sealSecret(SECRET, '482916', FAST));
  });

  it('detecta adulteração do texto cifrado', () => {
    const blob = JSON.parse(sealSecret(SECRET, '482916', FAST));
    const first = blob.ct[0] === 'a' ? 'b' : 'a';
    blob.ct = first + blob.ct.slice(1);
    expect(() => openSecret(JSON.stringify(blob), '482916')).toThrow(WrongPinError);
  });

  it('rejeita cofre malformado e parâmetros perigosos de KDF', () => {
    expect(() => openSecret('lixo', '482916')).toThrow(WrongPinError);
    const blob = JSON.parse(sealSecret(SECRET, '482916', FAST));
    blob.params.N = 2 ** 30; // tentativa de travar o app por consumo de memória
    expect(() => openSecret(JSON.stringify(blob), '482916')).toThrow(WrongPinError);
    blob.params.N = 1000; // não é potência de 2
    expect(() => openSecret(JSON.stringify(blob), '482916')).toThrow(WrongPinError);
  });
});

describe('regras de PIN', () => {
  it('aceita PINs fortes', () => {
    expect(assessPin('482916').ok).toBe(true);
    expect(assessPin('90731846').ok).toBe(true);
  });

  it.each(['12345', '111111', '123456', '654321', '000000', 'abc123', '12 345', '1234567890123'])(
    'recusa o PIN fraco ou inválido %s',
    (pin) => {
      const r = assessPin(pin);
      expect(r.ok).toBe(false);
      expect(r.reasons.length).toBeGreaterThan(0);
    },
  );
});

describe('proteção contra força bruta', () => {
  const T0 = 1_000_000;

  it('não bloqueia nas primeiras tentativas', () => {
    let s = INITIAL_PIN_STATE;
    for (let i = 0; i < DEFAULT_PIN_POLICY.freeAttempts; i++) s = recordFailure(s, T0).state;
    expect(isLocked(s, T0)).toBe(false);
  });

  it('bloqueia com tempo crescente após as tentativas livres', () => {
    let s = INITIAL_PIN_STATE;
    for (let i = 0; i < DEFAULT_PIN_POLICY.freeAttempts; i++) s = recordFailure(s, T0).state;
    s = recordFailure(s, T0).state;
    expect(lockRemainingMs(s, T0)).toBe(30_000);
    s = recordFailure(s, T0).state;
    expect(lockRemainingMs(s, T0)).toBe(60_000);
    s = recordFailure(s, T0).state;
    expect(lockRemainingMs(s, T0)).toBe(120_000);
  });

  it('o bloqueio expira com o tempo', () => {
    let s = INITIAL_PIN_STATE;
    for (let i = 0; i < DEFAULT_PIN_POLICY.freeAttempts + 1; i++) s = recordFailure(s, T0).state;
    expect(isLocked(s, T0 + 29_999)).toBe(true);
    expect(isLocked(s, T0 + 30_000)).toBe(false);
  });

  it('limita o bloqueio ao máximo', () => {
    let s = INITIAL_PIN_STATE;
    for (let i = 0; i < 9; i++) s = recordFailure(s, T0).state;
    expect(lockRemainingMs(s, T0)).toBeLessThanOrEqual(DEFAULT_PIN_POLICY.maxLockMs);
  });

  it('manda apagar a carteira no limite de falhas', () => {
    let s = INITIAL_PIN_STATE;
    let wipe = false;
    for (let i = 0; i < DEFAULT_PIN_POLICY.wipeAfter; i++) {
      const r = recordFailure(s, T0);
      s = r.state;
      wipe = r.wipe;
      if (i < DEFAULT_PIN_POLICY.wipeAfter - 1) expect(wipe).toBe(false);
    }
    expect(wipe).toBe(true);
  });

  it('um acerto zera as falhas', () => {
    expect(recordSuccess()).toEqual(INITIAL_PIN_STATE);
  });
});
