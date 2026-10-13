import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import { NETWORKS, type NetworkInfo, type NetworkName } from './network.js';

/** 0 = endereços de recebimento, 1 = endereços de troco (BIP44/BIP84). */
export type Chain = 0 | 1;

export interface DerivedAddress {
  readonly address: string;
  readonly path: string;
  readonly chain: Chain;
  readonly index: number;
  readonly publicKey: Uint8Array;
  /** scriptPubKey P2WPKH, usado como witnessUtxo ao gastar. */
  readonly script: Uint8Array;
}

/**
 * Chaves HD BIP84 (Native SegWit, P2WPKH) a partir de uma seed.
 * Caminho: m/84'/coin'/0'/chain/index.
 */
export class HDWalletKeys {
  readonly network: NetworkInfo;
  #root: HDKey | null;

  constructor(seed: Uint8Array, network: NetworkName) {
    this.network = NETWORKS[network];
    this.#root = HDKey.fromMasterSeed(seed);
  }

  get accountPath(): string {
    return `m/84'/${this.network.coinType}'/0'`;
  }

  addressAt(chain: Chain, index: number): DerivedAddress {
    assertIndex(index);
    const path = `${this.accountPath}/${chain}/${index}`;
    const node = this.#requireRoot().derive(path);
    const publicKey = node.publicKey;
    if (!publicKey) throw new Error('Falha ao derivar a chave pública.');
    const payment = btc.p2wpkh(publicKey, this.network.btc);
    if (!payment.address) throw new Error('Falha ao derivar o endereço.');
    return { address: payment.address, path, chain, index, publicKey, script: payment.script };
  }

  /** Chave privada de um endereço. Uso interno da assinatura; nunca exponha na UI. */
  privateKeyAt(chain: Chain, index: number): Uint8Array {
    assertIndex(index);
    const node = this.#requireRoot().derive(`${this.accountPath}/${chain}/${index}`);
    if (!node.privateKey) throw new Error('Chave privada indisponível.');
    return node.privateKey;
  }

  get isLocked(): boolean {
    return this.#root === null;
  }

  /** Apaga os dados privados da memória (melhor esforço em JavaScript). */
  lock(): void {
    this.#root?.wipePrivateData();
    this.#root = null;
  }

  #requireRoot(): HDKey {
    if (!this.#root) throw new Error('Carteira bloqueada.');
    return this.#root;
  }
}

function assertIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= 0x80000000) {
    throw new RangeError('Índice de endereço inválido.');
  }
}
