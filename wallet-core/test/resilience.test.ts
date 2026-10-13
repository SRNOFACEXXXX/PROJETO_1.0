import { describe, expect, it } from 'vitest';
import {
  ExplorerError,
  GAP,
  HDWalletKeys,
  MempoolExplorer,
  RateLimitedError,
  mnemonicToSeed,
  syncWallet,
  type Explorer,
} from '../src/index.js';

const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TXID = 'c'.repeat(64);
const ADDR = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
const FEES = '{"fastestFee":9,"halfHourFee":7,"hourFee":5,"economyFee":2,"minimumFee":1}';

type Reply = { status: number; body?: string; retryAfter?: string };

/** fetch falso que responde em sequência e anota o que aconteceu. */
function scripted(replies: Array<Reply | 'throw'>) {
  const log = { calls: 0, urls: [] as string[] };
  const fetchImpl = async (url: string) => {
    const r = replies[Math.min(log.calls, replies.length - 1)]!;
    log.calls++;
    log.urls.push(url);
    if (r === 'throw') throw new Error('segredo interno ECONNRESET');
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => r.body ?? '',
      headers: { get: (n: string) => (n.toLowerCase() === 'retry-after' ? (r.retryAfter ?? null) : null) },
    };
  };
  return { fetchImpl, log };
}

function explorer(replies: Array<Reply | 'throw'>, extra: object = {}) {
  const delays: number[] = [];
  const s = scripted(replies);
  const ex = new MempoolExplorer('https://x/api', s.fetchImpl, {
    sleep: async (ms) => void delays.push(ms),
    random: () => 0,
    minGapMs: 0,
    ...extra,
  });
  return { ex, delays, log: s.log };
}

describe('recuo e novas tentativas (HTTP 429)', () => {
  it('429 seguido de sucesso: tenta de novo e devolve o resultado', async () => {
    const { ex, log, delays } = explorer([{ status: 429 }, { status: 200, body: FEES }]);
    expect((await ex.getFees()).fastest).toBe(9);
    expect(log.calls).toBe(2);
    expect(delays).toEqual([1000]); // 1ª espera = base (jitter zerado no teste)
  });

  it('o recuo cresce de forma exponencial entre as tentativas', async () => {
    const { ex, delays } = explorer([{ status: 429 }, { status: 429 }, { status: 429 }, { status: 200, body: FEES }]);
    await ex.getFees();
    expect(delays).toEqual([1000, 2000, 4000]);
  });

  it('respeita o cabeçalho Retry-After', async () => {
    const { ex, delays } = explorer([{ status: 429, retryAfter: '3' }, { status: 200, body: FEES }]);
    await ex.getFees();
    expect(delays).toEqual([3000]);
  });

  it('limita a espera máxima, mesmo que o servidor peça muito mais', async () => {
    const { ex, delays } = explorer([{ status: 429, retryAfter: '900' }, { status: 200, body: FEES }], { maxDelayMs: 20_000 });
    await ex.getFees();
    expect(delays).toEqual([20_000]);
  });

  it('429 sem fim: desiste depois do limite e avisa que o servidor está ocupado', async () => {
    const { ex, log } = explorer([{ status: 429 }], { maxAttempts: 4 });
    await expect(ex.getFees()).rejects.toBeInstanceOf(RateLimitedError);
    expect(log.calls).toBe(4);
  });

  it('503/504 também são tentados de novo; 400 e 404 não', async () => {
    const a = explorer([{ status: 503 }, { status: 200, body: FEES }]);
    await a.ex.getFees();
    expect(a.log.calls).toBe(2);
    const b = explorer([{ status: 400 }, { status: 200, body: FEES }]);
    await expect(b.ex.getFees()).rejects.toThrow('HTTP 400');
    expect(b.log.calls).toBe(1);
    const c = explorer([{ status: 404 }]);
    await expect(c.ex.getFees()).rejects.toThrow('HTTP 404');
    expect(c.log.calls).toBe(1);
  });

  it('falha de rede é tentada de novo e some com detalhes internos na mensagem final', async () => {
    const ok = explorer(['throw', { status: 200, body: FEES }]);
    expect((await ok.ex.getFees()).fastest).toBe(9);
    const dead = explorer(['throw'], { maxAttempts: 3 });
    const err = await dead.ex.getFees().catch((e) => e);
    expect(err).toBeInstanceOf(ExplorerError);
    expect(String(err.message)).not.toContain('ECONNRESET');
    expect(dead.log.calls).toBe(3);
  });
});

describe('broadcast nunca é repetido às cegas', () => {
  it('erro de rede no envio: uma única tentativa (a transação pode já ter sido aceita)', async () => {
    const { ex, log } = explorer(['throw', { status: 200, body: TXID }]);
    await expect(ex.broadcast('0200abcd')).rejects.toBeInstanceOf(ExplorerError);
    expect(log.calls).toBe(1);
  });

  it('429 no envio: uma única tentativa, e o erro informa o limite', async () => {
    const { ex, log } = explorer([{ status: 429 }, { status: 200, body: TXID }]);
    await expect(ex.broadcast('0200abcd')).rejects.toBeInstanceOf(RateLimitedError);
    expect(log.calls).toBe(1);
  });
});

describe('limite de requisições simultâneas', () => {
  it('nunca passa de maxConcurrent em voo', async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchImpl = async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 8));
      inFlight--;
      return { ok: true, status: 200, text: async () => FEES };
    };
    const ex = new MempoolExplorer('https://x/api', fetchImpl, { maxConcurrent: 2, minGapMs: 0, sleep: async () => undefined });
    await Promise.all(Array.from({ length: 12 }, () => ex.getFees()));
    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(0);
  });
});

describe('custo da varredura (consultas ao servidor)', () => {
  const keys = new HDWalletKeys(mnemonicToSeed(ABANDON), 'mainnet');
  const empty: Explorer = {
    getAddressInfo: async () => ({ txCount: 0 }),
    getUtxos: async () => [],
    getFees: async () => ({ fastest: 1, halfHour: 1, hour: 1, economy: 1, minimum: 1 }),
    broadcast: async () => TXID,
  };

  it('carteira recém-criada: 6 consultas (3 endereços x 2 cadeias)', async () => {
    expect((await syncWallet(keys, empty, { gapLimit: GAP.fresh })).requests).toBe(6);
  });

  it('atualização comum: 10 consultas', async () => {
    expect((await syncWallet(keys, empty, { gapLimit: GAP.refresh })).requests).toBe(10);
  });

  it('restauração (BIP44): 40 consultas, sem passar do necessário', async () => {
    expect((await syncWallet(keys, empty, { gapLimit: GAP.restore })).requests).toBe(40);
  });

  it('nunca consulta além de último usado + limite de lacuna', async () => {
    const asked: string[] = [];
    const used = keys.addressAt(0, 2).address; // dentro da lacuna de 3 a partir do início
    const ex: Explorer = {
      ...empty,
      getAddressInfo: async (a) => {
        asked.push(a);
        return { txCount: a === used ? 1 : 0 };
      },
      getUtxos: async () => [{ txid: TXID, vout: 0, value: 500n, confirmed: true }],
    };
    const s = await syncWallet(keys, ex, { gapLimit: 3 });
    const farthest = Math.max(...asked.map((a) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((i) => keys.addressAt(0, i).address === a) ?? -1));
    expect(farthest).toBe(5); // último usado (2) + lacuna (3)
    expect(s.confirmedSats).toBe(500n);
    expect(s.nextReceive.index).toBe(3);
  });

  it('erro do servidor no meio da varredura vira exceção clara, sem estado pela metade', async () => {
    let n = 0;
    const flaky: Explorer = {
      ...empty,
      getAddressInfo: async () => {
        if (++n === 4) throw new RateLimitedError(5000);
        return { txCount: 0 };
      },
    };
    await expect(syncWallet(keys, flaky, { gapLimit: GAP.restore })).rejects.toBeInstanceOf(RateLimitedError);
  });
});

void ADDR;
