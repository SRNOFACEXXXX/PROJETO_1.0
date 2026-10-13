import { describe, expect, it } from 'vitest';
import { bytesToHex } from '@noble/hashes/utils.js';
import { HDWalletKeys, InvalidMnemonicError, isValidMnemonic, mnemonicToSeed, newMnemonic, normalizeMnemonic } from '../src/index.js';

// Vetor público do BIP84: mnemonic "abandon ... about", conta 0.
const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('BIP39', () => {
  it('gera 12 palavras válidas com 128 bits e 24 com 256 bits', () => {
    expect(newMnemonic(128).split(' ')).toHaveLength(12);
    expect(newMnemonic(256).split(' ')).toHaveLength(24);
    expect(isValidMnemonic(newMnemonic())).toBe(true);
  });

  it('gera mnemônicos diferentes a cada chamada', () => {
    const set = new Set(Array.from({ length: 50 }, () => newMnemonic()));
    expect(set.size).toBe(50);
  });

  it('produz a seed do vetor oficial (passphrase TREZOR)', () => {
    const seed = mnemonicToSeed(ABANDON, 'TREZOR');
    expect(bytesToHex(seed)).toBe(
      'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
    );
  });

  it('normaliza espaços e maiúsculas', () => {
    expect(isValidMnemonic('  ' + ABANDON.toUpperCase().replace(/ /g, '   ') + ' ')).toBe(true);
    expect(normalizeMnemonic('  A   B ')).toBe('a b');
  });

  it('rejeita checksum inválido, palavra desconhecida e tamanho errado', () => {
    expect(isValidMnemonic(ABANDON.replace('about', 'abandon'))).toBe(false);
    expect(isValidMnemonic(ABANDON.replace('about', 'zzzzzz'))).toBe(false);
    expect(isValidMnemonic('abandon abandon abandon')).toBe(false);
    expect(() => mnemonicToSeed('abandon abandon abandon')).toThrow(InvalidMnemonicError);
  });
});

describe('BIP84 (Native SegWit)', () => {
  const mainnet = new HDWalletKeys(mnemonicToSeed(ABANDON), 'mainnet');

  it('deriva os endereços de recebimento do vetor oficial', () => {
    expect(mainnet.addressAt(0, 0).address).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    expect(mainnet.addressAt(0, 1).address).toBe('bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
  });

  it('deriva o endereço de troco do vetor oficial', () => {
    expect(mainnet.addressAt(1, 0).address).toBe('bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el');
  });

  it('usa o caminho m/84\'/coin\'/0\'/chain/index', () => {
    expect(mainnet.addressAt(0, 0).path).toBe("m/84'/0'/0'/0/0");
    const testnet = new HDWalletKeys(mnemonicToSeed(ABANDON), 'testnet');
    expect(testnet.addressAt(1, 7).path).toBe("m/84'/1'/0'/1/7");
  });

  it('testnet usa prefixo tb1 e endereços diferentes da mainnet', () => {
    const t = new HDWalletKeys(mnemonicToSeed(ABANDON), 'testnet').addressAt(0, 0).address;
    expect(t.startsWith('tb1q')).toBe(true);
    expect(t).not.toBe(mainnet.addressAt(0, 0).address);
  });

  it('rejeita índices inválidos', () => {
    expect(() => mainnet.addressAt(0, -1)).toThrow(RangeError);
    expect(() => mainnet.addressAt(0, 1.5)).toThrow(RangeError);
    expect(() => mainnet.addressAt(0, 0x80000000)).toThrow(RangeError);
  });

  it('bloqueada: não deriva mais chaves depois de lock()', () => {
    const k = new HDWalletKeys(mnemonicToSeed(ABANDON), 'mainnet');
    k.lock();
    expect(k.isLocked).toBe(true);
    expect(() => k.addressAt(0, 0)).toThrow('bloqueada');
    expect(() => k.privateKeyAt(0, 0)).toThrow('bloqueada');
  });
});
