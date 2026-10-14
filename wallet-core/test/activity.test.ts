import { describe, expect, it } from 'vitest';
import {
  ExplorerError,
  HDWalletKeys,
  MempoolExplorer,
  buildActivity,
  confirmations,
  dayLabel,
  formatBrlFixed,
  mnemonicToSeed,
  syncWallet,
  type Explorer,
  type RawTx,
} from '../src/index.js';

const ME = new Set(['tb1qme0', 'tb1qme1', 'tb1qchange']);
const T = (n: number) => String(n).repeat(64).slice(0, 64);
const tx = (id: number, inputs: Array<[string | null, number]>, outputs: Array<[string | null, number]>, over: Partial<RawTx> = {}): RawTx => ({
  txid: T(id),
  confirmed: true,
  blockHeight: 100,
  blockTime: 1_700_000_000_000,
  fee: 500n,
  inputs: inputs.map(([address, v]) => ({ address, value: BigInt(v) })),
  outputs: outputs.map(([address, v]) => ({ address, value: BigInt(v) })),
  ...over,
});

describe('buildActivity', () => {
  it('recebido: nenhuma entrada é nossa', () => {
    const [a] = buildActivity([tx(1, [['tb1qother', 60_000]], [['tb1qme0', 50_000], ['tb1qother2', 9_500]])], ME, 105);
    expect(a).toMatchObject({ kind: 'received', amountSats: 50_000n, feeSats: 0n, confirmed: true, confirmations: 6 });
  });

  it('enviado: o troco não conta como valor enviado', () => {
    const [a] = buildActivity([tx(2, [['tb1qme0', 100_000]], [['tb1qdest', 30_000], ['tb1qchange', 69_500]])], ME, 100);
    expect(a).toMatchObject({ kind: 'sent', amountSats: 30_000n, feeSats: 500n, confirmations: 1 });
  });

  it('consolidação: todas as saídas são nossas, só a taxa sai', () => {
    const [a] = buildActivity([tx(3, [['tb1qme0', 20_000], ['tb1qme1', 20_000]], [['tb1qchange', 39_500]])], ME, 100);
    expect(a).toMatchObject({ kind: 'self', amountSats: 500n, feeSats: 500n });
  });

  it('ignora transações que não envolvem a carteira', () => {
    expect(buildActivity([tx(4, [['tb1qa', 1_000]], [['tb1qb', 500]])], ME, 100)).toEqual([]);
  });

  it('remove duplicatas (a mesma transação vem de dois endereços)', () => {
    const t = tx(5, [['tb1qother', 60_000]], [['tb1qme0', 20_000], ['tb1qme1', 39_500]]);
    expect(buildActivity([t, t], ME, 100)).toHaveLength(1);
  });

  it('não confirmada: 0 confirmações, sem hora, aparece antes das confirmadas', () => {
    const pending = tx(6, [['tb1qother', 5_000]], [['tb1qme0', 4_500]], { confirmed: false, blockHeight: null, blockTime: null });
    const old = tx(7, [['tb1qother', 5_000]], [['tb1qme0', 4_500]], { blockTime: 1_600_000_000_000 });
    const newer = tx(8, [['tb1qother', 5_000]], [['tb1qme0', 4_500]], { blockTime: 1_700_000_000_000 });
    const out = buildActivity([old, newer, pending], ME, 200);
    expect(out.map((i) => i.txid)).toEqual([T(6), T(8), T(7)]);
    expect(out[0]).toMatchObject({ confirmed: false, confirmations: 0, time: null });
  });

  it('endereços sem forma conhecida (OP_RETURN) não quebram', () => {
    const [a] = buildActivity([tx(9, [['tb1qme0', 10_000]], [[null, 0], ['tb1qdest', 9_000]])], ME, 100);
    expect(a!.kind).toBe('sent');
  });
});

describe('confirmations e dayLabel', () => {
  it('conta a partir do bloco da transação', () => {
    expect(confirmations(100, 100)).toBe(1);
    expect(confirmations(100, 105)).toBe(6);
    expect(confirmations(null, 105)).toBe(0);
    expect(confirmations(110, 105)).toBe(0); // ponta atrasada: nunca negativo
  });

  it('HOJE, ONTEM e data completa, respeitando o fuso', () => {
    const now = Date.UTC(2026, 9, 13, 15, 0); // 13/10 12:00 em Brasília
    expect(dayLabel(Date.UTC(2026, 9, 13, 14, 0), now, -180)).toBe('HOJE');
    expect(dayLabel(Date.UTC(2026, 9, 12, 20, 0), now, -180)).toBe('ONTEM');
    expect(dayLabel(Date.UTC(2026, 9, 1, 12, 0), now, -180)).toBe('01/10/2026');
    expect(dayLabel(null, now, -180)).toBe('HOJE');
    // 02:00 UTC de 13/10 ainda é 23:00 de 12/10 em Brasília
    expect(dayLabel(Date.UTC(2026, 9, 13, 2, 0), now, -180)).toBe('ONTEM');
  });
});

describe('formatBrlFixed', () => {
  it.each([
    [4360.86, 'R$ 4.360,86'],
    [0, 'R$ 0,00'],
    [0.5, 'R$ 0,50'],
    [1234567.891, 'R$ 1.234.567,89'],
    [-12.3, '-R$ 12,30'],
    [Number.NaN, '—'],
  ])('%s -> %s', (v, out) => expect(formatBrlFixed(v)).toBe(out));
});

describe('MempoolExplorer.getAddressTxs / getTipHeight', () => {
  const body = [
    {
      txid: T(1),
      fee: 141,
      status: { confirmed: true, block_height: 123, block_time: 1_700_000_000 },
      vin: [{ prevout: { scriptpubkey_address: 'tb1qsrc', value: 10_000 } }],
      vout: [{ scriptpubkey_address: 'tb1qme0', value: 9_859 }, { value: 0 }],
    },
    { txid: T(2), fee: 100, status: { confirmed: false }, vin: [], vout: [] },
  ];
  const ex = (replies: Record<string, unknown>) =>
    new MempoolExplorer(
      'https://x/api',
      async (url) => {
        const key = Object.keys(replies).find((k) => url.endsWith(k));
        const status = key ? 200 : 404;
        return { ok: status === 200, status, text: async () => (key ? (typeof replies[key] === 'string' ? (replies[key] as string) : JSON.stringify(replies[key])) : ''), headers: { get: () => null } };
      },
      { sleep: async () => undefined, minGapMs: 0 },
    );

  it('lê transações confirmadas e pendentes, em satoshis (bigint) e ms', async () => {
    const txs = await ex({ '/txs': body }).getAddressTxs('tb1qme0aaaaaaaaaaaaaaaa');
    expect(txs[0]).toMatchObject({ confirmed: true, blockHeight: 123, blockTime: 1_700_000_000_000, fee: 141n });
    expect(txs[0]!.inputs[0]).toEqual({ address: 'tb1qsrc', value: 10_000n });
    expect(txs[0]!.outputs[1]).toEqual({ address: null, value: 0n });
    expect(txs[1]).toMatchObject({ confirmed: false, blockHeight: null, blockTime: null });
  });

  it('recusa respostas malformadas ou hostis', async () => {
    await expect(ex({ '/txs': { erro: 1 } }).getAddressTxs('tb1qme0aaaaaaaaaaaaaaaa')).rejects.toBeInstanceOf(ExplorerError);
    await expect(ex({ '/txs': [{ txid: 'curto', fee: 1, status: { confirmed: false }, vin: [], vout: [] }] }).getAddressTxs('tb1qme0aaaaaaaaaaaaaaaa')).rejects.toThrow('txid');
    await expect(ex({ '/txs': [{ txid: T(1), fee: -5, status: { confirmed: false }, vin: [], vout: [] }] }).getAddressTxs('tb1qme0aaaaaaaaaaaaaaaa')).rejects.toBeInstanceOf(ExplorerError);
    await expect(ex({ '/txs': [{ txid: T(1), fee: 1, status: { confirmed: true }, vin: [], vout: [] }] }).getAddressTxs('tb1qme0aaaaaaaaaaaaaaaa')).rejects.toBeInstanceOf(ExplorerError);
    await expect(ex({}).getAddressTxs('../etc')).rejects.toBeInstanceOf(ExplorerError);
  });

  it('altura do bloco: aceita inteiro, recusa lixo', async () => {
    expect(await ex({ '/blocks/tip/height': '905432' }).getTipHeight()).toBe(905432);
    await expect(ex({ '/blocks/tip/height': 'abc' }).getTipHeight()).rejects.toBeInstanceOf(ExplorerError);
    await expect(ex({ '/blocks/tip/height': '-4' }).getTipHeight()).rejects.toBeInstanceOf(ExplorerError);
  });
});

describe('syncWallet expõe os endereços com histórico', () => {
  it('usedAddresses lista só quem tem transações', async () => {
    const keys = new HDWalletKeys(mnemonicToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'), 'testnet');
    const used = new Set([keys.addressAt(0, 0).address, keys.addressAt(1, 1).address]);
    const explorer: Explorer = {
      getAddressInfo: async (a) => ({ txCount: used.has(a) ? 2 : 0 }),
      getUtxos: async () => [],
      getFees: async () => ({ fastest: 1, halfHour: 1, hour: 1, economy: 1, minimum: 1 }),
      broadcast: async () => T(1),
    };
    const s = await syncWallet(keys, explorer, { gapLimit: 3 });
    expect(s.usedAddresses.map((a) => a.address).sort()).toEqual([...used].sort());
  });
});
