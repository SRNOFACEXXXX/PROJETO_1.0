import { describe, expect, it } from 'vitest';
import { ExplorerError, HDWalletKeys, MempoolExplorer, mnemonicToSeed, syncWallet, type Explorer } from '../src/index.js';

const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TXID = 'b'.repeat(64);

function fakeFetch(handlers: Record<string, { status?: number; body: string }>, calls: string[] = []) {
  return async (url: string, init?: { method?: string; body?: string }) => {
    calls.push((init?.method ?? 'GET') + ' ' + url);
    const key = Object.keys(handlers).find((k) => url.endsWith(k));
    const h = key ? handlers[key]! : { status: 404, body: 'not found' };
    const status = h.status ?? 200;
    return { ok: status >= 200 && status < 300, status, text: async () => h.body };
  };
}

describe('MempoolExplorer', () => {
  it('lê UTXOs e converte valores para bigint', async () => {
    const ex = new MempoolExplorer(
      'https://x/api',
      fakeFetch({
        '/utxo': { body: JSON.stringify([{ txid: TXID, vout: 1, value: 12345, status: { confirmed: true } }]) },
      }),
    );
    const u = await ex.getUtxos('tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pz3cppk');
    expect(u).toEqual([{ txid: TXID, vout: 1, value: 12345n, confirmed: true }]);
  });

  it('lê taxas recomendadas', async () => {
    const ex = new MempoolExplorer(
      'https://x/api',
      fakeFetch({ '/v1/fees/recommended': { body: '{"fastestFee":9,"halfHourFee":7,"hourFee":5,"economyFee":2,"minimumFee":1}' } }),
    );
    expect(await ex.getFees()).toEqual({ fastest: 9, halfHour: 7, hour: 5, economy: 2, minimum: 1 });
  });

  it('faz broadcast e valida o txid devolvido', async () => {
    const calls: string[] = [];
    const ex = new MempoolExplorer('https://x/api', fakeFetch({ '/tx': { body: TXID + '\n' } }, calls));
    expect(await ex.broadcast('0200abcd')).toBe(TXID);
    expect(calls[0]).toBe('POST https://x/api/tx');
  });

  it('recusa respostas maliciosas ou malformadas', async () => {
    const bad = (body: string) => new MempoolExplorer('https://x/api', fakeFetch({ '/utxo': { body } }));
    const addr = 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pz3cppk';
    await expect(bad('{"nao":"lista"}').getUtxos(addr)).rejects.toThrow(ExplorerError);
    await expect(bad('<html>erro</html>').getUtxos(addr)).rejects.toThrow(ExplorerError);
    await expect(bad(JSON.stringify([{ txid: 'curto', vout: 0, value: 1, status: { confirmed: true } }])).getUtxos(addr)).rejects.toThrow(ExplorerError);
    await expect(bad(JSON.stringify([{ txid: TXID, vout: 0, value: -5, status: { confirmed: true } }])).getUtxos(addr)).rejects.toThrow(ExplorerError);
    await expect(bad(JSON.stringify([{ txid: TXID, vout: 0, value: '1', status: { confirmed: true } }])).getUtxos(addr)).rejects.toThrow(ExplorerError);
  });

  it('não permite injeção de caminho no endereço nem hex inválido no broadcast', async () => {
    const ex = new MempoolExplorer('https://x/api', fakeFetch({}));
    await expect(ex.getUtxos('../../admin')).rejects.toThrow(ExplorerError);
    await expect(ex.getAddressInfo('a/b?c=d')).rejects.toThrow(ExplorerError);
    await expect(ex.broadcast('não é hex')).rejects.toThrow(ExplorerError);
  });

  it('propaga erro HTTP e falha de rede com mensagem segura', async () => {
    const http500 = new MempoolExplorer('https://x/api', fakeFetch({ '/v1/fees/recommended': { status: 500, body: 'boom' } }));
    await expect(http500.getFees()).rejects.toThrow('HTTP 500');
    const offline = new MempoolExplorer('https://x/api', async () => {
      throw new Error('segredo interno ECONNREFUSED 10.0.0.1');
    });
    await expect(offline.getFees()).rejects.toThrow('Falha de rede');
    await expect(offline.getFees()).rejects.not.toThrow('10.0.0.1');
  });
});

describe('syncWallet', () => {
  const keys = new HDWalletKeys(mnemonicToSeed(ABANDON), 'testnet');

  function fakeExplorer(used: Map<string, bigint>): Explorer {
    return {
      getAddressInfo: async (a) => ({ txCount: used.has(a) ? 1 : 0 }),
      getUtxos: async (a) => (used.has(a) ? [{ txid: TXID, vout: 0, value: used.get(a)!, confirmed: true }] : []),
      getFees: async () => ({ fastest: 1, halfHour: 1, hour: 1, economy: 1, minimum: 1 }),
      broadcast: async () => TXID,
    };
  }

  it('carteira vazia: saldo zero e próximo endereço é o índice 0', async () => {
    const s = await syncWallet(keys, fakeExplorer(new Map()));
    expect(s.confirmedSats).toBe(0n);
    expect(s.nextReceive.index).toBe(0);
    expect(s.nextChange.index).toBe(0);
  });

  it('soma saldos e avança o próximo endereço', async () => {
    const used = new Map<string, bigint>([
      [keys.addressAt(0, 0).address, 1000n],
      [keys.addressAt(0, 3).address, 2000n],
      [keys.addressAt(1, 1).address, 500n],
    ]);
    const s = await syncWallet(keys, fakeExplorer(used));
    expect(s.confirmedSats).toBe(3500n);
    expect(s.utxos).toHaveLength(3);
    expect(s.nextReceive.index).toBe(4);
    expect(s.nextChange.index).toBe(2);
  });

  it('encontra endereço usado dentro do limite de lacuna e ignora o que está além', async () => {
    const within = new Map([[keys.addressAt(0, 19).address, 700n]]);
    expect((await syncWallet(keys, fakeExplorer(within))).confirmedSats).toBe(700n);
    const beyond = new Map([[keys.addressAt(0, 40).address, 700n]]);
    expect((await syncWallet(keys, fakeExplorer(beyond))).confirmedSats).toBe(0n);
  });

  it('separa saldo pendente do confirmado', async () => {
    const ex = fakeExplorer(new Map([[keys.addressAt(0, 0).address, 1n]]));
    ex.getUtxos = async () => [
      { txid: TXID, vout: 0, value: 1000n, confirmed: true },
      { txid: TXID, vout: 1, value: 250n, confirmed: false },
    ];
    const s = await syncWallet(keys, ex);
    expect(s.confirmedSats).toBe(1000n);
    expect(s.pendingSats).toBe(250n);
  });
});
