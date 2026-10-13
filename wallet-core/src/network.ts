import * as btc from '@scure/btc-signer';

export type NetworkName = 'mainnet' | 'testnet';

export interface NetworkInfo {
  readonly name: NetworkName;
  readonly btc: typeof btc.NETWORK;
  /** SLIP-44 coin type usado no caminho BIP84 (0 = mainnet, 1 = testnets). */
  readonly coinType: 0 | 1;
  /** URL base da API REST do mempool.space para esta rede. */
  readonly explorerApi: string;
}

export const NETWORKS: Readonly<Record<NetworkName, NetworkInfo>> = {
  mainnet: {
    name: 'mainnet',
    btc: btc.NETWORK,
    coinType: 0,
    explorerApi: 'https://mempool.space/api',
  },
  testnet: {
    name: 'testnet',
    btc: btc.TEST_NETWORK,
    coinType: 1,
    // Testnet4: a testnet3 foi descontinuada.
    explorerApi: 'https://mempool.space/testnet4/api',
  },
};

/** Rede padrão: testnet. Mainnet exige escolha explícita do chamador. */
export const DEFAULT_NETWORK: NetworkName = 'testnet';
