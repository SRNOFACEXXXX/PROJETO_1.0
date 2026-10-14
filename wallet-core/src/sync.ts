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
  /** Quantas consultas ao explorador a varredura fez (para medir o custo). */
  requests: number;
  /** Endereços que já têm histórico (base da tela Atividade). */
  usedAddresses: DerivedAddress[];
}

export interface SyncOptions {
  /** Endereços seguidos sem uso que encerram a varredura. Padrão BIP44: 20. */
  gapLimit?: number;
  /** Endereços consultados por rodada. Poucos, para não estourar o limite do servidor. */
  batch?: number;
  /** Chamado a cada rodada, para a interface mostrar andamento. */
  onProgress?: (info: { chain: Chain; scanned: number }) => void;
}

/** Limites de varredura recomendados para cada situação. */
export const GAP = {
  /** Importar/restaurar uma frase: pode haver histórico antigo; use o padrão do BIP44. */
  restore: 20,
  /** Já houve uma varredura antes neste aparelho: basta olhar pouco além do último usado. */
  refresh: 5,
  /** Carteira recém-criada neste aparelho: ainda não pode haver histórico. */
  fresh: 3,
} as const;

/**
 * Varre as duas cadeias (recebimento e troco) até encontrar `gapLimit`
 * endereços seguidos sem uso, como manda o BIP44. Só pede as saídas (UTXO) de
 * endereços que têm histórico, e nunca consulta mais endereços do que o necessário.
 */
export async function syncWallet(keys: HDWalletKeys, explorer: Explorer, opts: SyncOptions = {}): Promise<WalletState> {
  const gapLimit = opts.gapLimit ?? GAP.restore;
  const batch = Math.max(1, opts.batch ?? 2);
  const utxos: Utxo[] = [];
  const usedAddresses: DerivedAddress[] = [];
  const next: Record<Chain, DerivedAddress> = { 0: keys.addressAt(0, 0), 1: keys.addressAt(1, 0) };
  let requests = 0;

  for (const chain of [0, 1] as const) {
    let index = 0;
    let lastUsed = -1;
    // Precisa olhar até lastUsed + gapLimit (inclusive).
    while (index <= lastUsed + gapLimit) {
      const count = Math.min(batch, lastUsed + gapLimit + 1 - index);
      const addrs: DerivedAddress[] = [];
      for (let i = 0; i < count; i++) addrs.push(keys.addressAt(chain, index + i));
      const results = await Promise.all(
        addrs.map(async (a) => {
          const info = await explorer.getAddressInfo(a.address);
          requests++;
          const found = info.txCount > 0 ? await explorer.getUtxos(a.address) : [];
          if (info.txCount > 0) requests++;
          return { a, used: info.txCount > 0, found };
        }),
      );
      for (const r of results) {
        if (r.used) {
          lastUsed = Math.max(lastUsed, r.a.index);
          usedAddresses.push(r.a);
        }
        for (const u of r.found) {
          utxos.push({ txid: u.txid, vout: u.vout, value: u.value, confirmed: u.confirmed, chain, index: r.a.index });
        }
      }
      index += count;
      opts.onProgress?.({ chain, scanned: index });
    }
    next[chain] = keys.addressAt(chain, lastUsed + 1);
  }

  let confirmedSats = 0n;
  let pendingSats = 0n;
  for (const u of utxos) {
    if (u.confirmed) confirmedSats += u.value;
    else pendingSats += u.value;
  }
  return { utxos, confirmedSats, pendingSats, nextReceive: next[0], nextChange: next[1], requests, usedAddresses };
}
