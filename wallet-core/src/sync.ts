import type { Explorer } from './explorer.js';
import type { Chain, DerivedAddress, HDWalletKeys } from './keys.js';
import type { Utxo } from './tx.js';

export interface WalletState {
  utxos: Utxo[];
  /** Saldo confirmado, em satoshis. */
  confirmedSats: bigint;
  /** Saldo ainda não confirmado, em satoshis. */
  pendingSats: bigint;
  nextReceive: DerivedAddress;
  nextChange: DerivedAddress;
}

const BATCH = 5;

/**
 * Varre as duas cadeias (recebimento e troco) até encontrar `gapLimit`
 * endereços seguidos sem uso, como manda o BIP44.
 */
export async function syncWallet(keys: HDWalletKeys, explorer: Explorer, gapLimit = 20): Promise<WalletState> {
  const utxos: Utxo[] = [];
  const next: Record<Chain, DerivedAddress> = { 0: keys.addressAt(0, 0), 1: keys.addressAt(1, 0) };

  for (const chain of [0, 1] as const) {
    let index = 0;
    let lastUsed = -1;
    while (index - lastUsed <= gapLimit) {
      const batch: DerivedAddress[] = [];
      for (let i = 0; i < BATCH; i++) batch.push(keys.addressAt(chain, index + i));
      const results = await Promise.all(
        batch.map(async (a) => {
          const info = await explorer.getAddressInfo(a.address);
          const found = info.txCount > 0 ? await explorer.getUtxos(a.address) : [];
          return { a, used: info.txCount > 0, found };
        }),
      );
      for (const r of results) {
        if (r.used) lastUsed = Math.max(lastUsed, r.a.index);
        for (const u of r.found) {
          utxos.push({ txid: u.txid, vout: u.vout, value: u.value, confirmed: u.confirmed, chain, index: r.a.index });
        }
      }
      index += BATCH;
    }
    next[chain] = keys.addressAt(chain, lastUsed + 1);
  }

  let confirmedSats = 0n;
  let pendingSats = 0n;
  for (const u of utxos) {
    if (u.confirmed) confirmedSats += u.value;
    else pendingSats += u.value;
  }
  return { utxos, confirmedSats, pendingSats, nextReceive: next[0], nextChange: next[1] };
}
