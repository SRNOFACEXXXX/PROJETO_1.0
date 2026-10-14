import {
  HDWalletKeys,
  INITIAL_PIN_STATE,
  WrongPinError,
  assessPin,
  isLocked,
  lockRemainingMs,
  mnemonicToSeed,
  openSecret,
  packSecret,
  recordFailure,
  recordSuccess,
  sealSecret,
  unpackSecret,
  type NetworkName,
  type VaultSecret,
} from '@brbit/wallet-core';
import { loadNetwork, loadPinState, loadVault, savePinState, saveVault, wipeAll } from './storage';

/**
 * Sessão da carteira. As chaves só existem em memória enquanto a carteira
 * estiver desbloqueada; o mnemônico nunca é guardado em variável de módulo.
 */
let keys: HDWalletKeys | null = null;

/**
 * Custo do scrypt no celular. Medido no Hermes (JavaScript puro, sem JIT): com N = 2^14 abrir o
 * cofre levava ~50 s no emulador; com 2^12 cai para uma fração disso. A proteção principal da
 * seed é o Keystore/Keychain do sistema, que guarda o cofre; um PIN de 6 dígitos (~20 bits) não
 * ganha segurança real com um scrypt mais pesado, só ganha espera. O custo vem gravado em cada
 * cofre, então cofres antigos continuam abrindo com o custo com que foram criados.
 */
export const MOBILE_KDF = { N: 2 ** 12, r: 8, p: 1 };

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
  // O PBKDF2 da seed (2.048 voltas, lento no Hermes) roda uma única vez, aqui; depois fica no cofre.
  const seed = mnemonicToSeed(mnemonic);
  const sealed = sealSecret(packSecret(mnemonic, seed), pin, MOBILE_KDF);
  await saveVault(sealed);
  await savePinState({ ...INITIAL_PIN_STATE });
  lockWallet();
  keys = new HDWalletKeys(seed, network);
  seed.fill(0);
}

/** Resultado de uma tentativa de PIN que NÃO abriu o cofre. */
export type PinFailure =
  | { ok: false; reason: 'locked'; remainingMs: number }
  /** `lockedMs` > 0 quando esta própria tentativa errada acionou o bloqueio: o usuário já deve ser avisado. */
  | { ok: false; reason: 'wrong'; failures: number; lockedMs: number }
  | { ok: false; reason: 'wiped' }
  | { ok: false; reason: 'nowallet' };

export type UnlockResult = { ok: true } | PinFailure;
export type RevealResult = { ok: true; mnemonic: string } | PinFailure;

/**
 * Único lugar que abre o cofre com o PIN. Respeita o bloqueio por tentativas, conta erros,
 * persiste o contador (reabrir o app não zera) e apaga tudo no limite de falhas.
 */
async function openVault(pin: string): Promise<{ ok: true; secret: VaultSecret } | PinFailure> {
  const sealed = await loadVault();
  if (!sealed) return { ok: false, reason: 'nowallet' };
  const state = await loadPinState();
  const now = Date.now();
  if (isLocked(state, now)) return { ok: false, reason: 'locked', remainingMs: lockRemainingMs(state, now) };
  await paint();
  try {
    const secret = unpackSecret(openSecret(sealed, pin), mnemonicToSeed);
    await savePinState(recordSuccess());
    return { ok: true, secret };
  } catch (e) {
    if (!(e instanceof WrongPinError)) throw e;
    const r = recordFailure(state, Date.now());
    if (r.wipe) {
      lockWallet();
      await wipeAll();
      return { ok: false, reason: 'wiped' };
    }
    await savePinState(r.state);
    return { ok: false, reason: 'wrong', failures: r.state.failures, lockedMs: lockRemainingMs(r.state, Date.now()) };
  }
}

export async function unlockWallet(pin: string): Promise<UnlockResult> {
  const r = await openVault(pin);
  if (!r.ok) return r;
  lockWallet();
  keys = new HDWalletKeys(r.secret.seed, await loadNetwork());
  r.secret.seed.fill(0);
  return { ok: true };
}

/** Reautentica com o PIN sem trocar a sessão (usado para autorizar envios). */
export async function verifyPin(pin: string): Promise<UnlockResult> {
  const r = await openVault(pin);
  if (!r.ok) return r;
  r.secret.seed.fill(0);
  return { ok: true };
}

/**
 * Devolve a frase de recuperação, SOMENTE com o PIN correto e respeitando o bloqueio por tentativas.
 * Quem chama deve exibir em tela segura e descartar o texto ao sair.
 */
export async function revealMnemonic(pin: string): Promise<RevealResult> {
  const r = await openVault(pin);
  if (!r.ok) return r;
  r.secret.seed.fill(0);
  return { ok: true, mnemonic: r.secret.mnemonic };
}

export async function eraseWallet(): Promise<void> {
  lockWallet();
  await wipeAll();
}
