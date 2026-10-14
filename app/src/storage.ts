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

/**
 * Último estado conhecido da carteira, só para mostrar algo quando a rede falha.
 * Contém apenas números (saldo e índices); nunca chaves, palavras ou endereços.
 * O saldo em cache NÃO é usado para enviar: o envio sempre exige a rede.
 */
export interface WalletCache {
  confirmed: string;
  pending: string;
  receiveIndex: number;
  changeIndex: number;
  at: number;
}

const cacheKey = (n: NetworkName) => `brbit.cache.${n}.v1`;

export async function loadCache(n: NetworkName): Promise<WalletCache | null> {
  const raw = await SecureStore.getItemAsync(cacheKey(n));
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<WalletCache>;
    if (
      typeof c.confirmed === 'string' && /^\d+$/.test(c.confirmed) &&
      typeof c.pending === 'string' && /^\d+$/.test(c.pending) &&
      Number.isInteger(c.receiveIndex) && Number.isInteger(c.changeIndex) && Number.isFinite(c.at)
    ) {
      return c as WalletCache;
    }
  } catch {
    // cache corrompido: ignora (é só conveniência)
  }
  return null;
}

export async function saveCache(n: NetworkName, c: WalletCache): Promise<void> {
  await SecureStore.setItemAsync(cacheKey(n), JSON.stringify(c));
}

/** Apaga TUDO: cofre, contagem de PIN, preferências e caches. */
export async function wipeAll(): Promise<void> {
  const keys: string[] = [...Object.values(K), cacheKey('mainnet'), cacheKey('testnet')];
  await Promise.all(keys.map((k) => SecureStore.deleteItemAsync(k)));
}
