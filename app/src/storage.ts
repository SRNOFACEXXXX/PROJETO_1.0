import * as SecureStore from 'expo-secure-store';
import { DEFAULT_NETWORK, INITIAL_PIN_STATE, type NetworkName, type PinGuardState } from '@brbit/wallet-core';

/**
 * Tudo é gravado no SecureStore (Android Keystore / iOS Keychain). O cofre da
 * seed já chega aqui criptografado pelo PIN (veja wallet-core/vault).
 */
const K = {
  vault: 'brbit.vault.v1',
  pin: 'brbit.pinstate.v1',
  network: 'brbit.network.v1',
} as const;

export async function loadVault(): Promise<string | null> {
  return SecureStore.getItemAsync(K.vault);
}

export async function saveVault(sealed: string): Promise<void> {
  await SecureStore.setItemAsync(K.vault, sealed);
}

export async function loadPinState(): Promise<PinGuardState> {
  const raw = await SecureStore.getItemAsync(K.pin);
  if (!raw) return { ...INITIAL_PIN_STATE };
  try {
    const p = JSON.parse(raw) as Partial<PinGuardState>;
    if (Number.isFinite(p.failures) && Number.isFinite(p.lockedUntil)) {
      return { failures: Number(p.failures), lockedUntil: Number(p.lockedUntil) };
    }
  } catch {
    // estado corrompido: trate como tentativa já consumida, não como zerado
  }
  return { failures: 4, lockedUntil: Date.now() + 30_000 };
}

export async function savePinState(state: PinGuardState): Promise<void> {
  await SecureStore.setItemAsync(K.pin, JSON.stringify(state));
}

export async function loadNetwork(): Promise<NetworkName> {
  const v = await SecureStore.getItemAsync(K.network);
  return v === 'mainnet' || v === 'testnet' ? v : DEFAULT_NETWORK;
}

export async function saveNetwork(n: NetworkName): Promise<void> {
  await SecureStore.setItemAsync(K.network, n);
}

/** Apaga TUDO: cofre, contagem de PIN e preferências. */
export async function wipeAll(): Promise<void> {
  await Promise.all(Object.values(K).map((k) => SecureStore.deleteItemAsync(k)));
}
