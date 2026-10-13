/**
 * Verificação cruzada: confere o nosso núcleo (@scure/@noble) contra uma
 * implementação totalmente independente (bitcoinjs-lib + bip32 + tiny-secp256k1).
 * Se as duas discordarem em algum endereço ou assinatura, o teste falha.
 */
import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { describe, expect, it } from 'vitest';
import { HDWalletKeys, buildAndSign, mnemonicToSeed, newMnemonic, type Chain, type Utxo } from '../src/index.js';

const bip32 = BIP32Factory(ecc);
const NETS = { mainnet: bitcoin.networks.bitcoin, testnet: bitcoin.networks.testnet } as const;
const COIN = { mainnet: 0, testnet: 1 } as const;

function independentAddress(seed: Uint8Array, net: 'mainnet' | 'testnet', chain: Chain, index: number) {
  const node = bip32.fromSeed(seed, NETS[net]).derivePath(`m/84'/${COIN[net]}'/0'/${chain}/${index}`);
  const p = bitcoin.payments.p2wpkh({ pubkey: node.publicKey, network: NETS[net] });
  return { address: p.address!, pubkey: node.publicKey };
}

describe('verificação cruzada com bitcoinjs-lib', () => {
  it('deriva exatamente os mesmos endereços em mnemônicos aleatórios, duas redes e duas cadeias', () => {
    for (let m = 0; m < 5; m++) {
      const seed = mnemonicToSeed(newMnemonic(m % 2 ? 256 : 128));
      for (const net of ['mainnet', 'testnet'] as const) {
        const ours = new HDWalletKeys(seed, net);
        for (const chain of [0, 1] as const) {
          for (const index of [0, 1, 2, 19, 100, 2_147_483_000]) {
            const a = ours.addressAt(chain, index);
            const b = independentAddress(seed, net, chain, index);
            expect(a.address).toBe(b.address);
            expect(Buffer.from(a.publicKey).toString('hex')).toBe(Buffer.from(b.pubkey).toString('hex'));
          }
        }
      }
    }
  });

  it('a transação assinada tem assinaturas ECDSA válidas e low-S em todas as entradas', () => {
    const seed = mnemonicToSeed(newMnemonic());
    const keys = new HDWalletKeys(seed, 'testnet');
    const destination = independentAddress(mnemonicToSeed(newMnemonic()), 'testnet', 0, 0).address;

    // Três entradas em endereços diferentes, para exercitar várias chaves.
    const owned: Utxo[] = [
      { txid: '11'.repeat(32), vout: 0, value: 40_000n, chain: 0, index: 0, confirmed: true },
      { txid: '22'.repeat(32), vout: 3, value: 25_000n, chain: 0, index: 5, confirmed: true },
      { txid: '33'.repeat(32), vout: 1, value: 15_000n, chain: 1, index: 2, confirmed: true },
    ];
    const signed = buildAndSign({
      keys,
      utxos: owned,
      to: destination,
      amountSats: 70_000n,
      feeRate: 4,
      changeAddress: keys.addressAt(1, 3),
    });

    const tx = bitcoin.Transaction.fromHex(signed.hex);
    expect(tx.ins).toHaveLength(3);
    expect(tx.getId()).toBe(signed.txid);
    expect(tx.virtualSize()).toBe(signed.vsize);

    const byOutpoint = new Map(owned.map((u) => [`${u.txid}:${u.vout}`, u]));
    for (let i = 0; i < tx.ins.length; i++) {
      const input = tx.ins[i]!;
      const txid = Buffer.from(input.hash).reverse().toString('hex');
      const u = byOutpoint.get(`${txid}:${input.index}`)!;
      expect(u).toBeDefined();

      const [sigWithType, pubkey] = input.witness as [Uint8Array, Uint8Array];
      const { signature, hashType } = bitcoin.script.signature.decode(sigWithType);
      expect(hashType).toBe(bitcoin.Transaction.SIGHASH_ALL);

      // A chave da assinatura tem de ser a do endereço que recebeu a moeda.
      const expected = independentAddress(seed, 'testnet', u.chain, u.index);
      expect(Buffer.from(pubkey).toString('hex')).toBe(Buffer.from(expected.pubkey).toString('hex'));

      // scriptCode do P2WPKH (BIP143) e verificação criptográfica independente.
      const scriptCode = bitcoin.payments.p2pkh({ pubkey }).output!;
      const sighash = tx.hashForWitnessV0(i, scriptCode, u.value, bitcoin.Transaction.SIGHASH_ALL);
      expect(ecc.verify(sighash, pubkey, signature, true)).toBe(true); // true = exige low-S
    }
  });

  it('uma assinatura adulterada deixa de verificar (o teste de verificação não é vazio)', () => {
    const seed = mnemonicToSeed(newMnemonic());
    const keys = new HDWalletKeys(seed, 'testnet');
    const u: Utxo = { txid: '44'.repeat(32), vout: 0, value: 50_000n, chain: 0, index: 0, confirmed: true };
    const signed = buildAndSign({
      keys,
      utxos: [u],
      to: independentAddress(mnemonicToSeed(newMnemonic()), 'testnet', 0, 0).address,
      amountSats: 10_000n,
      feeRate: 3,
      changeAddress: keys.addressAt(1, 0),
    });
    const tx = bitcoin.Transaction.fromHex(signed.hex);
    const [sigWithType, pubkey] = tx.ins[0]!.witness as [Uint8Array, Uint8Array];
    const { signature } = bitcoin.script.signature.decode(sigWithType);
    const scriptCode = bitcoin.payments.p2pkh({ pubkey }).output!;
    const sighash = tx.hashForWitnessV0(0, scriptCode, u.value, bitcoin.Transaction.SIGHASH_ALL);
    expect(ecc.verify(sighash, pubkey, signature, true)).toBe(true);

    const tampered = Uint8Array.from(signature);
    tampered[10] = (tampered[10]! ^ 0xff) & 0xff;
    expect(ecc.verify(sighash, pubkey, tampered, true)).toBe(false);

    // E uma mudança de valor invalida o sighash original.
    const otherSighash = tx.hashForWitnessV0(0, scriptCode, u.value + 1n, bitcoin.Transaction.SIGHASH_ALL);
    expect(ecc.verify(otherSighash, pubkey, signature, true)).toBe(false);
  });
});
