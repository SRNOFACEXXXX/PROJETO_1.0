import type { RawTx } from './explorer.js';

export type ActivityKind = 'received' | 'sent' | 'self';

export interface ActivityItem {
  txid: string;
  kind: ActivityKind;
  /** Valor da movimentação em satoshis, sempre positivo: recebido, enviado a terceiros, ou a taxa (consolidação). */
  amountSats: bigint;
  /** Taxa paga (só faz sentido quando a carteira enviou). */
  feeSats: bigint;
  confirmed: boolean;
  confirmations: number;
  /** ms desde a época; null enquanto não confirmada. */
  time: number | null;
}

/** Confirmações a partir da altura do bloco da transação e da ponta da cadeia. */
export function confirmations(blockHeight: number | null, tip: number): number {
  if (blockHeight === null || tip < blockHeight) return 0;
  return tip - blockHeight + 1;
}

/**
 * Converte transações cruas em itens de atividade da carteira.
 *  - recebido: nenhuma entrada é nossa;
 *  - enviado: alguma entrada é nossa e há saída para terceiros (o troco não conta como enviado);
 *  - consolidação: todas as saídas são nossas (só pagamos a taxa).
 */
export function buildActivity(txs: readonly RawTx[], own: ReadonlySet<string>, tip: number): ActivityItem[] {
  const seen = new Set<string>();
  const items: ActivityItem[] = [];
  for (const tx of txs) {
    if (seen.has(tx.txid)) continue;
    seen.add(tx.txid);
    let ownIn = 0n;
    let ownOut = 0n;
    let foreignOut = 0n;
    for (const i of tx.inputs) if (i.address && own.has(i.address)) ownIn += i.value;
    for (const o of tx.outputs) {
      if (o.address && own.has(o.address)) ownOut += o.value;
      else foreignOut += o.value;
    }
    if (ownIn === 0n && ownOut === 0n) continue; // não envolve esta carteira
    const base = {
      txid: tx.txid,
      confirmed: tx.confirmed,
      confirmations: tx.confirmed ? confirmations(tx.blockHeight, tip) : 0,
      time: tx.blockTime,
    };
    if (ownIn === 0n) {
      items.push({ ...base, kind: 'received', amountSats: ownOut, feeSats: 0n });
    } else if (foreignOut === 0n) {
      items.push({ ...base, kind: 'self', amountSats: tx.fee, feeSats: tx.fee });
    } else {
      items.push({ ...base, kind: 'sent', amountSats: foreignOut, feeSats: tx.fee });
    }
  }
  // Não confirmadas primeiro; depois da mais recente para a mais antiga.
  return items.sort((a, b) => {
    if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1;
    return (b.time ?? 0) - (a.time ?? 0);
  });
}

/** "HOJE" / "ONTEM" / "13/10/2026", comparando datas no fuso informado (minutos a somar ao UTC). */
export function dayLabel(ms: number | null, now: number, tzOffsetMin: number): string {
  if (ms === null) return 'HOJE';
  const day = (t: number) => Math.floor((t + tzOffsetMin * 60_000) / 86_400_000);
  const diff = day(now) - day(ms);
  if (diff <= 0) return 'HOJE';
  if (diff === 1) return 'ONTEM';
  const d = new Date(ms + tzOffsetMin * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
