import {
  HDWalletKeys,
  INITIAL_PIN_STATE,
  WrongPinError,
  isLocked,
  lockRemainingMs,
  mnemonicToSeed,
  openSecret,
  recordFailure,
  recordSuccess,
  sealSecret,
  assessPin,
  type NetworkName,
} from '@brbit/wallet-core';
import { loadNetwork, loadPinState, loadVault, savePinState, saveVault, wipeAll } from './storage';

/**
 * Sessão da carteira. As chaves só existem em memória enquanto a carteira
 * estiver desbloqueada; o mnemônico nunca é guardado em variável de módulo.
 */
let keys: HDWalletKeys | null = null;

/** Custo do scrypt no celular. Ajustado após medir no Hermes. */
export const MOBILE_KDF = { N: 2 ** 14, r: 8, p: 1 };

/** Cede o thread para a interface pintar antes de um cálculo pesado. */
const paint = () => new Promise<void>((r) => setTimeout(r, 50));

export async function hasWallet(): Promise<boolean> {
  return (await loadVault()) !== null;
}

export function currentKeys(): HDWalletKeys | null {
  return keys && !keys.isLocked ? keys : null;
}

export function lockWallet(): void {
  keys?.lock();
  keys = null;
}

/** Verdadeiro logo após criar uma carteira NOVA aqui: ainda não pode haver histórico na rede. */
let freshWallet = false;
export const isFreshWallet = () => freshWallet;
export const markSynced = () => {
  freshWallet = false;
};

/** Cria o cofre com o PIN e deixa a carteira desbloqueada. `isNew`: frase gerada agora (não importada). */
export async function createWallet(mnemonic: string, pin: string, network: NetworkName, isNew = false): Promise<void> {
  freshWallet = isNew;
  const a = assessPin(pin);
  if (!a.ok) throw new Error(a.reasons[0]);
  await paint();
  const sealed = sealSecret(mnemonic, pin, MOBILE_KDF);
  await saveVault(sealed);
  await savePinState({ ...INITIAL_PIN_STATE });
  lockWallet();
  keys = new HDWalletKeys(mnemonicToSeed(mnemonic), network);
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'locked'; remainingMs: number }
  | { ok: false; reason: 'wrong'; failures: number }
  | { ok: false; reason: 'wiped' }
  | { ok: false; reason: 'nowallet' };

export async function unlockWallet(pin: string): Promise<UnlockResult> {
  const sealed = await loadVault();
  if (!sealed) return { ok: false, reason: 'nowallet' };
  const state = await loadPinState();
  const now = Date.now();
  if (isLocked(state, now)) return { ok: false, reason: 'locked', remainingMs: lockRemainingMs(state, now) };
  await paint();
  try {
    const mnemonic = openSecret(sealed, pin);
    await savePinState(recordSuccess());
    lockWallet();
    keys = new HDWalletKeys(mnemonicToSeed(mnemonic), await loadNetwork());
    return { ok: true };
  } catch (e) {
    if (!(e instanceof WrongPinError)) throw e;
    const r = recordFailure(state, Date.now());
    if (r.wipe) {
      lockWallet();
      await wipeAll();
      return { ok: false, reason: 'wiped' };
    }
    await savePinState(r.state);
    return { ok: false, reason: 'wrong', failures: r.state.failures };
  }
}

/** Reautentica com o PIN sem trocar a sessão (usado para autorizar envios). */
export async function verifyPin(pin: string): Promise<UnlockResult> {
  const sealed = await loadVault();
  if (!sealed) return { ok: false, reason: 'nowallet' };
  const state = await loadPinState();
  const now = Date.now();
  if (isLocked(state, now)) return { ok: false, reason: 'locked', remainingMs: lockRemainingMs(state, now) };
  await paint();
  try {
    openSecret(sealed, pin);
    await savePinState(recordSuccess());
    return { ok: true };
  } catch (e) {
    if (!(e instanceof WrongPinError)) throw e;
    const r = recordFailure(state, Date.now());
    if (r.wipe) {
      lockWallet();
      await wipeAll();
      return { ok: false, reason: 'wiped' };
    }
    await savePinState(r.state);
    return { ok: false, reason: 'wrong', failures: r.state.failures };
  }
}

export async function eraseWallet(): Promise<void> {
  lockWallet();
  await wipeAll();
}
