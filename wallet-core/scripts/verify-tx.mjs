// Verificação INDEPENDENTE (bitcoinjs-lib) de uma transação assinada pelo app, para os testes E2E.
// Uso: TEST_WORDS="..." node scripts/verify-tx.mjs <testnet|mainnet> <hex> <valorDaEntrada1,valorDaEntrada2,...>
// Imprime um JSON com: entradas (assinatura válida? de qual caminho BIP84?), saídas, tamanho, taxa.
// As palavras vêm por variável de ambiente e nunca são impressas.
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { mnemonicToSeedSync } from '@scure/bip39';

const [net, hex, valuesArg] = process.argv.slice(2);
const words = process.env.TEST_WORDS;
if (!words || !hex || !valuesArg) {
  console.error('uso: TEST_WORDS=... node verify-tx.mjs <rede> <hex> <valores>');
  process.exit(2);
}
const network = net === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
const coin = net === 'mainnet' ? 0 : 1;
const root = BIP32Factory(ecc).fromSeed(mnemonicToSeedSync(words), network);

// Mapa pubkey -> caminho para as primeiras 10 chaves de cada cadeia.
const known = new Map();
for (const chain of [0, 1]) {
  for (let i = 0; i < 10; i++) {
    const path = `m/84'/${coin}'/0'/${chain}/${i}`;
    known.set(Buffer.from(root.derivePath(path).publicKey).toString('hex'), path);
  }
}

const tx = bitcoin.Transaction.fromHex(hex);
const values = valuesArg.split(',').map((v) => BigInt(v));
if (values.length !== tx.ins.length) {
  console.error('quantidade de valores diferente da de entradas');
  process.exit(2);
}

const inputs = tx.ins.map((input, i) => {
  const [sigWithType, pubkey] = input.witness;
  const { signature, hashType } = bitcoin.script.signature.decode(sigWithType);
  const scriptCode = bitcoin.payments.p2pkh({ pubkey }).output;
  const sighash = tx.hashForWitnessV0(i, scriptCode, values[i], bitcoin.Transaction.SIGHASH_ALL);
  return {
    txid: Buffer.from(input.hash).reverse().toString('hex'),
    vout: input.index,
    hashTypeAll: hashType === bitcoin.Transaction.SIGHASH_ALL,
    signatureValid: ecc.verify(sighash, pubkey, signature, true), // true = exige low-S
    path: known.get(Buffer.from(pubkey).toString('hex')) ?? null,
  };
});

const outputs = tx.outs.map((o) => ({ address: bitcoin.address.fromOutputScript(o.script, network), value: Number(o.value) }));
const totalIn = values.reduce((a, b) => a + b, 0n);
const totalOut = tx.outs.reduce((a, o) => a + BigInt(o.value), 0n);
const fee = Number(totalIn - totalOut);
console.log(JSON.stringify({ txid: tx.getId(), vsize: tx.virtualSize(), fee, feeRate: fee / tx.virtualSize(), inputs, outputs }));
