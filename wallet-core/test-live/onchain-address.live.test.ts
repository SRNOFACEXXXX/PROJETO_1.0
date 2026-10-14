/**
 * Verificação AO VIVO dos endereços contra um scanner de blockchain (mempool.space).
 * Não movimenta nada e não usa nenhuma carteira real: só mnemônicos descartáveis gerados aqui.
 *
 * O que isto prova (e o que não prova):
 *  - O NÓ da rede confirma que o endereço é válido para aquela rede (checksum, prefixo, tipo),
 *    e que o scriptPubKey e o hash da chave pública batem com os que derivamos localmente.
 *  - Um endereço Bitcoin não "nasce" na blockchain: ele é derivado localmente e só passa a
 *    aparecer na cadeia quando recebe fundos. Por isso um endereço novo tem 0 transações.
 *  - O vetor público do BIP84 TEM histórico real na mainnet: prova que nossa derivação gera
 *    endereços que existem na cadeia.
 */
import { ripemd160 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { HDWalletKeys, NETWORKS, mnemonicToSeed, newMnemonic, type NetworkName } from '../src/index.js';

const BASE: Record<NetworkName, string> = {
  mainnet: NETWORKS.mainnet.explorerApi,
  testnet: NETWORKS.testnet.explorerApi,
};
const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(base: string, path: string): Promise<{ status: number; json: any }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(450); // gentileza com a API pública
    const res = await fetch(base + path);
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* corpo vazio em 400 */
    }
    return { status: res.status, json };
  }
  throw new Error('limite de requisições (429) persistente');
}

const hash160Hex = (pub: Uint8Array) => bytesToHex(ripemd160(sha256(pub)));

async function assertAddressOnChain(net: NetworkName, keys: HDWalletKeys, chain: 0 | 1, index: number) {
  const a = keys.addressAt(chain, index);
  const v = await api(BASE[net], `/v1/validate-address/${a.address}`);
  expect(v.status).toBe(200);
  expect(v.json.isvalid, `o nó da ${net} deveria aceitar ${a.address}`).toBe(true);
  expect(v.json.iswitness).toBe(true);
  expect(v.json.witness_version).toBe(0);
  expect(v.json.scriptPubKey).toBe(bytesToHex(a.script));
  expect(v.json.witness_program).toBe(hash160Hex(a.publicKey));
  return a;
}

describe.each(['testnet', 'mainnet'] as const)('endereços na %s', (net) => {
  const other: NetworkName = net === 'testnet' ? 'mainnet' : 'testnet';

  it('carteira descartável: o nó valida o endereço e o script bate com o derivado', async () => {
    const keys = new HDWalletKeys(mnemonicToSeed(newMnemonic()), net);
    for (const [chain, index] of [[0, 0], [0, 1], [1, 0]] as const) {
      const a = await assertAddressOnChain(net, keys, chain, index);
      expect(a.address.startsWith(net === 'testnet' ? 'tb1q' : 'bc1q')).toBe(true);
    }
  }, 60_000);

  it('endereço novo é reconhecido pela rede e ainda não tem histórico', async () => {
    const keys = new HDWalletKeys(mnemonicToSeed(newMnemonic()), net);
    const a = keys.addressAt(0, 0);
    const r = await api(BASE[net], `/address/${a.address}`);
    expect(r.status).toBe(200);
    expect(r.json.address).toBe(a.address);
    expect(r.json.chain_stats.tx_count).toBe(0);
    expect(r.json.mempool_stats.tx_count).toBe(0);
  }, 60_000);

  it(`a rede ${other} REJEITA o endereço da ${net} (prefixos não se misturam)`, async () => {
    const keys = new HDWalletKeys(mnemonicToSeed(newMnemonic()), net);
    const a = keys.addressAt(0, 0);
    const r = await api(BASE[other], `/address/${a.address}`);
    expect(r.status).toBe(400);
    const v = await api(BASE[other], `/v1/validate-address/${a.address}`);
    expect(v.json.isvalid).toBe(false);
  }, 60_000);

  it('controle negativo: trocar 1 caractere invalida o endereço (o teste não é vazio)', async () => {
    const keys = new HDWalletKeys(mnemonicToSeed(newMnemonic()), net);
    const good = keys.addressAt(0, 0).address;
    const last = good.at(-1) === 'q' ? 'p' : 'q';
    const bad = good.slice(0, -1) + last;
    const v = await api(BASE[net], `/v1/validate-address/${bad}`);
    expect(v.json.isvalid).toBe(false);
  }, 60_000);

  it('vetor BIP84 (abandon…about): endereço válido na rede', async () => {
    const keys = new HDWalletKeys(mnemonicToSeed(ABANDON), net);
    const a = await assertAddressOnChain(net, keys, 0, 0);
    const r = await api(BASE[net], `/address/${a.address}`);
    expect(r.status).toBe(200);
    console.log(`[${net}] ${a.address} -> ${r.json.chain_stats.tx_count} transações na cadeia`);
  }, 60_000);
});

describe('prova de existência na mainnet', () => {
  it('o endereço do vetor BIP84 derivado por nós TEM histórico real na blockchain', async () => {
    const keys = new HDWalletKeys(mnemonicToSeed(ABANDON), 'mainnet');
    const a = keys.addressAt(0, 0);
    expect(a.address).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'); // valor publicado no BIP84
    const r = await api(BASE.mainnet, `/address/${a.address}`);
    expect(r.status).toBe(200);
    expect(r.json.chain_stats.tx_count).toBeGreaterThan(0);
  }, 60_000);
});
