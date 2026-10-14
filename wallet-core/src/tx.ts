import * as btc from '@scure/btc-signer';
import type { Chain, DerivedAddress, HDWalletKeys } from './keys.js';

/** Menor valor de saída P2WPKH aceito pela rede (poeira), em satoshis. */
export const DUST_LIMIT_P2WPKH = 294n;

export interface Utxo {
  txid: string;
  vout: number;
  value: bigint;
  chain: Chain;
  index: number;
  confirmed: boolean;
}

export class InsufficientFundsError extends Error {
  constructor(readonly needed: bigint, readonly available: bigint) {
    super('Saldo insuficiente para o valor e a taxa.');
    this.name = 'InsufficientFundsError';
  }
}

export class InvalidTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransactionError';
  }
}

const INPUT_VBYTES = 68;
const OVERHEAD_VBYTES = 11;
const CHANGE_OUTPUT_VBYTES = 31;

type AddressType = 'pkh' | 'sh' | 'wpkh' | 'wsh' | 'tr';

const OUTPUT_VBYTES: Record<AddressType, number> = {
  pkh: 34,
  sh: 32,
  wpkh: 31,
  wsh: 43,
  tr: 43,
};

/** Tamanho virtual estimado (vbytes) de uma transação com entradas P2WPKH. */
export function estimateVBytes(inputs: number, destinationVBytes: number, withChange: boolean): number {
  return OVERHEAD_VBYTES + INPUT_VBYTES * inputs + destinationVBytes + (withChange ? CHANGE_OUTPUT_VBYTES : 0);
}

function feeFor(vbytes: number, feeRate: number): bigint {
  return BigInt(Math.ceil(vbytes * feeRate));
}

export interface CoinSelection {
  inputs: Utxo[];
  fee: bigint;
  /** Troco em satoshis; 0n quando o troco seria poeira e foi somado à taxa. */
  change: bigint;
}

export interface SelectOptions {
  /** Permite gastar saídas ainda não confirmadas. Padrão: false. */
  allowUnconfirmed?: boolean;
  destinationVBytes?: number;
}

/** Seleção de moedas por maior valor primeiro, com troco ou sem troco. */
export function selectCoins(
  utxos: readonly Utxo[],
  amount: bigint,
  feeRate: number,
  opts: SelectOptions = {},
): CoinSelection {
  if (amount < DUST_LIMIT_P2WPKH) throw new InvalidTransactionError('Valor abaixo do limite mínimo (poeira).');
  if (!Number.isFinite(feeRate) || feeRate <= 0) throw new InvalidTransactionError('Taxa inválida.');
  const dest = opts.destinationVBytes ?? OUTPUT_VBYTES.wpkh;
  const spendable = utxos
    .filter((u) => opts.allowUnconfirmed || u.confirmed)
    .sort((a, b) => (a.value === b.value ? 0 : a.value > b.value ? -1 : 1));
  const available = spendable.reduce((s, u) => s + u.value, 0n);

  const picked: Utxo[] = [];
  let total = 0n;
  for (const u of spendable) {
    picked.push(u);
    total += u.value;
    const feeWithChange = feeFor(estimateVBytes(picked.length, dest, true), feeRate);
    const feeNoChange = feeFor(estimateVBytes(picked.length, dest, false), feeRate);
    const change = total - amount - feeWithChange;
    if (change >= DUST_LIMIT_P2WPKH) return { inputs: picked, fee: feeWithChange, change };
    if (total >= amount + feeNoChange && total - amount - feeNoChange < DUST_LIMIT_P2WPKH) {
      // O troco seria poeira: vira taxa extra.
      return { inputs: picked, fee: total - amount, change: 0n };
    }
  }
  const needed = amount + feeFor(estimateVBytes(Math.max(1, picked.length), dest, false), feeRate);
  throw new InsufficientFundsError(needed, available);
}

/** Tamanho (vbytes) da saída de destino por tipo de endereço; usado para estimar a taxa antes de montar. */
export const DESTINATION_VBYTES = 31; // P2WPKH, o caso mais comum

/**
 * Maior valor que dá para enviar: todas as moedas gastáveis menos a taxa, sem troco.
 * Devolve 0n se o saldo não cobre a taxa ou sobraria menos que a poeira.
 */
export function maxSendable(
  utxos: readonly Utxo[],
  feeRate: number,
  opts: { allowUnconfirmed?: boolean; destinationVBytes?: number } = {},
): bigint {
  if (!Number.isFinite(feeRate) || feeRate <= 0) return 0n;
  const usable = utxos.filter((u) => opts.allowUnconfirmed || u.confirmed);
  if (usable.length === 0) return 0n;
  const total = usable.reduce((s, u) => s + u.value, 0n);
  const fee = feeFor(estimateVBytes(usable.length, opts.destinationVBytes ?? DESTINATION_VBYTES, false), feeRate);
  const max = total - fee;
  return max >= DUST_LIMIT_P2WPKH ? max : 0n;
}

export interface BuildParams {
  keys: HDWalletKeys;
  utxos: readonly Utxo[];
  to: string;
  amountSats: bigint;
  /** sat/vB */
  feeRate: number;
  changeAddress: DerivedAddress;
  allowUnconfirmed?: boolean;
  /** Proteção contra erro grosseiro: taxa acima do valor enviado é recusada. */
  allowHighFee?: boolean;
}

export interface SignedTransaction {
  hex: string;
  txid: string;
  vsize: number;
  feeSats: bigint;
  changeSats: bigint;
  amountSats: bigint;
  to: string;
}

/** Monta, assina (P2WPKH) e finaliza uma transação. Não envia nada à rede. */
export function buildAndSign(p: BuildParams): SignedTransaction {
  const network = p.keys.network.btc;
  let decoded: { type: string };
  try {
    decoded = btc.Address(network).decode(p.to) as { type: string };
  } catch {
    throw new InvalidTransactionError('Endereço de destino inválido para esta rede.');
  }
  const destVBytes = OUTPUT_VBYTES[decoded.type as AddressType];
  if (destVBytes === undefined) throw new InvalidTransactionError('Tipo de endereço de destino não suportado.');

  const sel = selectCoins(p.utxos, p.amountSats, p.feeRate, {
    allowUnconfirmed: p.allowUnconfirmed,
    destinationVBytes: destVBytes,
  });
  if (!p.allowHighFee && sel.fee > p.amountSats) {
    throw new InvalidTransactionError('A taxa seria maior que o valor enviado. Revise a taxa.');
  }

  const tx = new btc.Transaction();
  const signers: Uint8Array[] = [];
  for (const u of sel.inputs) {
    const addr = p.keys.addressAt(u.chain, u.index);
    tx.addInput({
      txid: u.txid,
      index: u.vout,
      witnessUtxo: { script: addr.script, amount: u.value },
    });
    signers.push(p.keys.privateKeyAt(u.chain, u.index));
  }
  tx.addOutputAddress(p.to, p.amountSats, network);
  if (sel.change > 0n) tx.addOutputAddress(p.changeAddress.address, sel.change, network);

  try {
    signers.forEach((key, i) => {
      if (!tx.signIdx(key, i)) throw new InvalidTransactionError('Falha ao assinar a entrada ' + i + '.');
    });
    tx.finalize();
  } finally {
    signers.forEach((k) => k.fill(0));
  }

  const totalIn = sel.inputs.reduce((s, u) => s + u.value, 0n);
  if (totalIn !== p.amountSats + sel.change + sel.fee) {
    throw new InvalidTransactionError('Inconsistência de valores; transação descartada.');
  }
  return {
    hex: tx.hex,
    txid: tx.id,
    vsize: tx.vsize,
    feeSats: sel.fee,
    changeSats: sel.change,
    amountSats: p.amountSats,
    to: p.to,
  };
}
