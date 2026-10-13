// Deriva o primeiro endereço de recebimento BIP84 com uma implementação INDEPENDENTE
// (bitcoinjs-lib + bip32), para conferir o endereço que o app mostra na tela.
// Uso: TEST_WORDS="..." node qa/derive-independent.mjs <mainnet|testnet> [chain] [index]
// As palavras vêm por variável de ambiente e nunca são impressas.
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { mnemonicToSeedSync } from '@scure/bip39';

const [net = 'testnet', chain = '0', index = '0'] = process.argv.slice(2);
const words = process.env.TEST_WORDS;
if (!words) {
  console.error('TEST_WORDS ausente');
  process.exit(2);
}
const network = net === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
const coin = net === 'mainnet' ? 0 : 1;
const node = BIP32Factory(ecc)
  .fromSeed(mnemonicToSeedSync(words), network)
  .derivePath(`m/84'/${coin}'/0'/${chain}/${index}`);
console.log(bitcoin.payments.p2wpkh({ pubkey: node.publicKey, network }).address);
