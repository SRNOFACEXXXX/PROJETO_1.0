// Servidor de TESTES que imita o essencial da API do mempool.space, para o app (testnet) enviar de verdade
// sem precisar de moedas reais ou de faucet. O app só fala com ele se o Metro foi iniciado com
// EXPO_PUBLIC_TESTNET_EXPLORER_URL (a mainnet NUNCA é redirecionada).
//
// Uso:  node qa/fake-mempool.mjs <porta> [endereço-a-financiar:saldo_em_sats]...
// Controle (só para o teste):
//   POST /_fund    {"address":"tb1q...","sats":100000}  -> cria um UTXO confirmado para o endereço
//   GET  /_state                                       -> transações recebidas por /tx (hex) e UTXOs
//   POST /_fail    {"status":429,"count":3}            -> as próximas N requisições respondem com esse erro
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';

const PORT = Number(process.argv[2] ?? 3999);
const utxos = new Map(); // endereço -> [{txid, vout, value, confirmed}]
const broadcasts = []; // hex das transações recebidas
let failure = { status: 0, count: 0 };

const hex = (n) => randomBytes(n).toString('hex');
const fund = (address, sats, confirmed = true) => {
  const list = utxos.get(address) ?? [];
  list.push({ txid: hex(32), vout: 0, value: sats, confirmed });
  utxos.set(address, list);
};

for (const arg of process.argv.slice(3)) {
  const [a, s] = arg.split(':');
  if (a && s) fund(a, Number(s));
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const text = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(body);
};
const read = (req) =>
  new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => resolve(b));
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/^\/api/, '');

  if (path === '/_fund' && req.method === 'POST') {
    const { address, sats } = JSON.parse(await read(req));
    fund(address, sats);
    return json(res, 200, { ok: true });
  }
  if (path === '/_fail' && req.method === 'POST') {
    failure = JSON.parse(await read(req));
    return json(res, 200, { ok: true });
  }
  if (path === '/_state') return json(res, 200, { broadcasts, utxos: Object.fromEntries(utxos) });

  if (failure.count > 0) {
    failure.count--;
    res.writeHead(failure.status, { 'Retry-After': '1' });
    return res.end('');
  }

  let m;
  if ((m = path.match(/^\/address\/([a-z0-9]+)$/))) {
    const l = utxos.get(m[1]) ?? [];
    const used = l.length;
    return json(res, 200, {
      address: m[1],
      chain_stats: { tx_count: used, funded_txo_count: used, spent_txo_count: 0 },
      mempool_stats: { tx_count: 0 },
    });
  }
  if ((m = path.match(/^\/address\/([a-z0-9]+)\/utxo$/))) {
    return json(
      res,
      200,
      (utxos.get(m[1]) ?? []).map((u) => ({ txid: u.txid, vout: u.vout, value: u.value, status: { confirmed: u.confirmed } })),
    );
  }
  if ((m = path.match(/^\/address\/([a-z0-9]+)\/txs$/))) return json(res, 200, []);
  if (path === '/v1/fees/recommended') return json(res, 200, { fastestFee: 6, halfHourFee: 4, hourFee: 2, economyFee: 1, minimumFee: 1 });
  if (path === '/blocks/tip/height') return text(res, 200, '123456');
  if (path === '/tx' && req.method === 'POST') {
    const body = (await read(req)).trim();
    broadcasts.push(body);
    // txid de verdade = dupla SHA-256 do hex sem a testemunha seria complexo; para o teste basta um id estável.
    return text(res, 200, createHash('sha256').update(body).digest('hex'));
  }
  json(res, 404, { error: 'não encontrado' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`fake-mempool em http://localhost:${PORT}`));
