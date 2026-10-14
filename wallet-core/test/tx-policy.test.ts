import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLICY,
  DUST_LIMIT_P2WPKH,
  HDWalletKeys,
  InsufficientFundsError,
  InvalidTransactionError,
  buildAndSign,
  evaluateSpend,
  maxSendable,
  mnemonicToSeed,
  selectCoins,
  type SpendPolicy,
  type Utxo,
} from '../src/index.js';

const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const keys = new HDWalletKeys(mnemonicToSeed(ABANDON), 'testnet');
const OTHER = new HDWalletKeys(mnemonicToSeed(ABANDON, 'outra'), 'testnet').addressAt(0, 0).address;
const TXID = 'a'.repeat(64);

const utxo = (value: bigint, n = 0, confirmed = true): Utxo => ({
  txid: String(n).repeat(64).slice(0, 64),
  vout: n,
  value,
  chain: 0,
  index: 0,
  confirmed,
});

describe('seleção de moedas', () => {
  it('escolhe a maior moeda e gera troco', () => {
    const s = selectCoins([utxo(10_000n, 1), utxo(100_000n, 2)], 30_000n, 5);
    expect(s.inputs).toHaveLength(1);
    expect(s.inputs[0]!.value).toBe(100_000n);
    expect(s.change).toBe(100_000n - 30_000n - s.fee);
    expect(s.fee).toBeGreaterThan(0n);
  });

  it('soma moedas quando uma só não basta', () => {
    const s = selectCoins([utxo(20_000n, 1), utxo(20_000n, 2)], 30_000n, 2);
    expect(s.inputs).toHaveLength(2);
  });

  it('descarta troco que seria poeira e soma à taxa', () => {
    const s = selectCoins([utxo(10_300n)], 10_000n, 1);
    expect(s.change).toBe(0n);
    expect(s.fee).toBe(300n);
  });

  it('ignora moedas não confirmadas por padrão', () => {
    expect(() => selectCoins([utxo(100_000n, 1, false)], 10_000n, 2)).toThrow(InsufficientFundsError);
    expect(selectCoins([utxo(100_000n, 1, false)], 10_000n, 2, { allowUnconfirmed: true }).inputs).toHaveLength(1);
  });

  it('falha com saldo insuficiente e informa o necessário', () => {
    try {
      selectCoins([utxo(5_000n)], 10_000n, 2);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(InsufficientFundsError);
      expect((e as InsufficientFundsError).available).toBe(5_000n);
      expect((e as InsufficientFundsError).needed).toBeGreaterThan(10_000n);
    }
  });

  it('recusa valor em poeira, zero e taxa inválida', () => {
    expect(() => selectCoins([utxo(100_000n)], DUST_LIMIT_P2WPKH - 1n, 2)).toThrow(InvalidTransactionError);
    expect(() => selectCoins([utxo(100_000n)], 0n, 2)).toThrow(InvalidTransactionError);
    expect(() => selectCoins([utxo(100_000n)], 10_000n, 0)).toThrow(InvalidTransactionError);
    expect(() => selectCoins([utxo(100_000n)], 10_000n, Number.NaN)).toThrow(InvalidTransactionError);
  });
});

describe('maxSendable (botão MAX)', () => {
  it('é o saldo menos a taxa, e enviar esse valor não deixa troco', () => {
    const utxos = [utxo(100_000n, 1), utxo(50_000n, 2)];
    const max = maxSendable(utxos, 5);
    expect(max).toBeGreaterThan(149_000n);
    expect(max).toBeLessThan(150_000n);
    const sel = selectCoins(utxos, max, 5);
    expect(sel.change).toBe(0n);
    expect(sel.inputs).toHaveLength(2);
    expect(sel.inputs.reduce((s, u) => s + u.value, 0n)).toBe(max + sel.fee);
  });

  it('ignora não confirmadas por padrão e zera quando não cobre a taxa', () => {
    expect(maxSendable([utxo(100_000n, 1, false)], 5)).toBe(0n);
    expect(maxSendable([utxo(100_000n, 1, false)], 5, { allowUnconfirmed: true })).toBeGreaterThan(0n);
    expect(maxSendable([], 5)).toBe(0n);
    expect(maxSendable([utxo(500n, 1)], 20)).toBe(0n);
  });

  it('taxa inválida devolve zero', () => {
    expect(maxSendable([utxo(100_000n, 1)], 0)).toBe(0n);
    expect(maxSendable([utxo(100_000n, 1)], Number.NaN)).toBe(0n);
  });
});

describe('montagem e assinatura', () => {
  const change = keys.addressAt(1, 0);
  const base = { keys, utxos: [utxo(100_000n, 1)], to: OTHER, amountSats: 30_000n, feeRate: 5, changeAddress: change };

  it('gera uma transação válida, com valores conferidos', () => {
    const signed = buildAndSign(base);
    const tx = btc.Transaction.fromRaw(Uint8Array.from(Buffer.from(signed.hex, 'hex')));
    expect(tx.inputsLength).toBe(1);
    expect(tx.outputsLength).toBe(2);
    expect(tx.getOutput(0).amount).toBe(30_000n);
    expect(tx.getOutput(1).amount).toBe(signed.changeSats);
    expect(100_000n).toBe(30_000n + signed.changeSats + signed.feeSats);
    expect(signed.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a taxa paga fica próxima da taxa pedida (±15%)', () => {
    const signed = buildAndSign(base);
    const rate = Number(signed.feeSats) / signed.vsize;
    expect(rate).toBeGreaterThan(5 * 0.85);
    expect(rate).toBeLessThan(5 * 1.15);
  });

  it('é determinística (assinatura RFC6979)', () => {
    expect(buildAndSign(base).hex).toBe(buildAndSign(base).hex);
  });

  it('troco vai para o endereço de troco da própria carteira', () => {
    const signed = buildAndSign(base);
    const tx = btc.Transaction.fromRaw(Uint8Array.from(Buffer.from(signed.hex, 'hex')));
    const out = tx.getOutput(1);
    expect(btc.Address(keys.network.btc).encode(btc.OutScript.decode(out.script!))).toBe(change.address);
  });

  it('recusa endereço da rede errada e endereço lixo', () => {
    expect(() => buildAndSign({ ...base, to: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu' })).toThrow(InvalidTransactionError);
    expect(() => buildAndSign({ ...base, to: 'isto-nao-e-um-endereco' })).toThrow(InvalidTransactionError);
    expect(() => buildAndSign({ ...base, to: '' })).toThrow(InvalidTransactionError);
  });

  it('recusa taxa maior que o valor enviado, a menos que autorizado', () => {
    const small = { ...base, utxos: [utxo(20_000n, 1)], amountSats: 400n, feeRate: 50 };
    expect(() => buildAndSign(small)).toThrow(InvalidTransactionError);
    expect(buildAndSign({ ...small, allowHighFee: true }).feeSats).toBeGreaterThan(400n);
  });

  it('não assina com a carteira bloqueada', () => {
    const k = new HDWalletKeys(mnemonicToSeed(ABANDON), 'testnet');
    k.lock();
    expect(() => buildAndSign({ ...base, keys: k })).toThrow();
  });
});

describe('política de gastos para agente (Claude)', () => {
  const NOW = 1_700_000_000_000;
  const policy: SpendPolicy = {
    agentEnabled: true,
    maxPerTxSats: 50_000n,
    maxPer24hSats: 80_000n,
    approvalThresholdSats: 20_000n,
    allowlist: [OTHER],
    maxFeeRate: 50,
  };
  const intent = { origin: 'agent' as const, to: OTHER, amountSats: 10_000n, feeRate: 5 };

  it('por padrão o agente é negado', () => {
    expect(evaluateSpend(DEFAULT_POLICY, intent, [], NOW).decision).toBe('deny');
  });

  it('permite valor pequeno para destino permitido', () => {
    expect(evaluateSpend(policy, intent, [], NOW).decision).toBe('allow');
  });

  it('exige aprovação acima do limiar ou para destino novo', () => {
    expect(evaluateSpend(policy, { ...intent, amountSats: 20_000n }, [], NOW).decision).toBe('needs_approval');
    expect(evaluateSpend(policy, { ...intent, to: keys.addressAt(0, 5).address }, [], NOW).decision).toBe('needs_approval');
  });

  it('nega acima do limite por transação e do limite de 24 h', () => {
    expect(evaluateSpend(policy, { ...intent, amountSats: 50_001n }, [], NOW).decision).toBe('deny');
    const hist = [{ at: NOW - 3_600_000, amountSats: 75_000n }];
    expect(evaluateSpend(policy, intent, hist, NOW).decision).toBe('deny');
  });

  it('gastos com mais de 24 h não contam no limite', () => {
    const hist = [{ at: NOW - 25 * 3_600_000, amountSats: 75_000n }];
    expect(evaluateSpend(policy, intent, hist, NOW).decision).toBe('allow');
  });

  it('nega taxa abusiva e valor inválido, inclusive do usuário', () => {
    expect(evaluateSpend(policy, { ...intent, feeRate: 51 }, [], NOW).decision).toBe('deny');
    expect(evaluateSpend(policy, { ...intent, origin: 'user', feeRate: 51 }, [], NOW).decision).toBe('deny');
    expect(evaluateSpend(policy, { ...intent, amountSats: 0n }, [], NOW).decision).toBe('deny');
    expect(evaluateSpend(policy, { ...intent, amountSats: -5n }, [], NOW).decision).toBe('deny');
  });

  it('ações diretas do usuário não passam pelos limites do agente', () => {
    expect(evaluateSpend(DEFAULT_POLICY, { ...intent, origin: 'user' }, [], NOW).decision).toBe('allow');
  });
});

void TXID;
