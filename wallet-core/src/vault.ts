import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scrypt } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js';

/**
 * Cofre criptografado da seed.
 * KDF: scrypt. Cifra: XChaCha20-Poly1305 (autenticada: erro de PIN ou
 * adulteração do dado falham na decifragem).
 *
 * Atenção: um PIN curto sozinho NÃO protege contra ataque offline a um cofre
 * extraído do aparelho. No app, o cofre deve ficar dentro do Keystore/Keychain
 * do sistema (hardware), que impede a extração e limita as tentativas.
 */

export interface KdfParams {
  /** Custo de CPU/memória; potência de 2. */
  N: number;
  r: number;
  p: number;
}

export const DEFAULT_KDF: KdfParams = { N: 2 ** 15, r: 8, p: 1 };

interface VaultBlob {
  v: 1;
  kdf: 'scrypt';
  params: KdfParams;
  salt: string;
  nonce: string;
  ct: string;
}

export class WrongPinError extends Error {
  constructor() {
    super('PIN incorreto ou cofre corrompido.');
    this.name = 'WrongPinError';
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function deriveKey(secret: string, salt: Uint8Array, params: KdfParams): Uint8Array {
  return scrypt(encoder.encode(secret.normalize('NFKD')), salt, { ...params, dkLen: 32 });
}

/** Criptografa um texto (ex.: o mnemônico) com o PIN e devolve um JSON. */
export function sealSecret(plaintext: string, pin: string, params: KdfParams = DEFAULT_KDF): string {
  const salt = randomBytes(16);
  const nonce = randomBytes(24);
  const key = deriveKey(pin, salt, params);
  try {
    const ct = xchacha20poly1305(key, nonce).encrypt(encoder.encode(plaintext));
    const blob: VaultBlob = {
      v: 1,
      kdf: 'scrypt',
      params,
      salt: bytesToHex(salt),
      nonce: bytesToHex(nonce),
      ct: bytesToHex(ct),
    };
    return JSON.stringify(blob);
  } finally {
    key.fill(0);
  }
}

/** Decifra o cofre. Lança WrongPinError se o PIN estiver errado ou o dado for adulterado. */
export function openSecret(sealed: string, pin: string): string {
  const blob = parseBlob(sealed);
  const key = deriveKey(pin, hexToBytes(blob.salt), blob.params);
  try {
    const pt = xchacha20poly1305(key, hexToBytes(blob.nonce)).decrypt(hexToBytes(blob.ct));
    return decoder.decode(pt);
  } catch {
    throw new WrongPinError();
  } finally {
    key.fill(0);
  }
}

export interface VaultSecret {
  mnemonic: string;
  /** Seed BIP39 de 64 bytes, já derivada: abrir o app não precisa refazer o PBKDF2 de 2.048 voltas. */
  seed: Uint8Array;
}

/**
 * Empacota mnemônico + seed num único texto para ser selado. Guardar a seed junto evita recalcular
 * o PBKDF2-SHA512 (2.048 voltas) a cada desbloqueio, que levava ~25 s no Hermes. Não reduz a
 * segurança: a seed é derivável do mnemônico, e ambos ficam dentro do mesmo cofre cifrado.
 */
export function packSecret(mnemonic: string, seed: Uint8Array): string {
  if (seed.length !== 64) throw new RangeError('A seed BIP39 tem 64 bytes.');
  return JSON.stringify({ v: 2, m: mnemonic, s: bytesToHex(seed) });
}

/**
 * Lê o que foi selado. Cofres antigos guardavam só o mnemônico em texto puro: nesse caso a seed
 * é derivada por `deriveSeed` (só acontece uma vez por cofre antigo, se o chamador regravar).
 */
export function unpackSecret(text: string, deriveSeed: (mnemonic: string) => Uint8Array): VaultSecret {
  if (text.startsWith('{')) {
    let o: { v?: unknown; m?: unknown; s?: unknown };
    try {
      o = JSON.parse(text);
    } catch {
      throw new Error('Cofre em formato inválido.');
    }
    if (o.v === 2 && typeof o.m === 'string' && typeof o.s === 'string' && /^[0-9a-f]{128}$/.test(o.s)) {
      return { mnemonic: o.m, seed: hexToBytes(o.s) };
    }
    throw new Error('Cofre em formato inválido.');
  }
  return { mnemonic: text, seed: deriveSeed(text) };
}

function parseBlob(sealed: string): VaultBlob {
  let raw: unknown;
  try {
    raw = JSON.parse(sealed);
  } catch {
    throw new WrongPinError();
  }
  const b = raw as Partial<VaultBlob>;
  const p = b.params;
  const ok =
    b.v === 1 &&
    b.kdf === 'scrypt' &&
    typeof b.salt === 'string' &&
    typeof b.nonce === 'string' &&
    typeof b.ct === 'string' &&
    !!p &&
    Number.isInteger(p.N) &&
    p.N >= 2 ** 10 &&
    p.N <= 2 ** 20 &&
    (p.N & (p.N - 1)) === 0 &&
    Number.isInteger(p.r) &&
    p.r >= 1 &&
    p.r <= 16 &&
    Number.isInteger(p.p) &&
    p.p >= 1 &&
    p.p <= 4;
  if (!ok) throw new WrongPinError();
  return b as VaultBlob;
}
