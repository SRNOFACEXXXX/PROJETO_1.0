import { MempoolExplorer, type HDWalletKeys } from '@brbit/wallet-core';

/**
 * Só para testes automáticos: aponta a TESTNET para um servidor local que imita a API do
 * mempool.space. A mainnet NUNCA é redirecionada, e sem a variável o app usa o endereço oficial.
 */
const TEST_OVERRIDE = process.env.EXPO_PUBLIC_TESTNET_EXPLORER_URL;

export function explorerBaseUrl(keys: HDWalletKeys): string {
  return keys.network.name === 'testnet' && TEST_OVERRIDE ? TEST_OVERRIDE : keys.network.explorerApi;
}

export function explorerFor(keys: HDWalletKeys): MempoolExplorer {
  return new MempoolExplorer(explorerBaseUrl(keys), fetch as never);
}
