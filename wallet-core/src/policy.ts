/**
 * Política de gastos para operação assistida (ex.: um modelo Claude propondo
 * transações). O modelo NUNCA assina sozinho: este módulo decide apenas se uma
 * proposta pode seguir, precisa de aprovação humana ou deve ser negada.
 * Ações iniciadas pelo próprio usuário não passam por esta política.
 */

export interface SpendPolicy {
  /** Se false, propostas de agente são sempre negadas. */
  agentEnabled: boolean;
  maxPerTxSats: bigint;
  /** Limite acumulado em janela móvel de 24 h. */
  maxPer24hSats: bigint;
  /** Valores a partir deste limite exigem aprovação humana. 0n = sempre exige. */
  approvalThresholdSats: bigint;
  /** Destinos permitidos sem aprovação (lista de endereços). */
  allowlist: readonly string[];
  maxFeeRate: number;
}

/** Padrão conservador: agente desligado, e qualquer gasto exigiria aprovação. */
export const DEFAULT_POLICY: SpendPolicy = {
  agentEnabled: false,
  maxPerTxSats: 0n,
  maxPer24hSats: 0n,
  approvalThresholdSats: 0n,
  allowlist: [],
  maxFeeRate: 100,
};

export type Origin = 'user' | 'agent';

export interface SpendIntent {
  origin: Origin;
  to: string;
  amountSats: bigint;
  feeRate: number;
}

export interface PastSpend {
  /** ms desde a época */
  at: number;
  amountSats: bigint;
}

export type DecisionKind = 'allow' | 'needs_approval' | 'deny';

export interface Decision {
  decision: DecisionKind;
  reasons: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateSpend(
  policy: SpendPolicy,
  intent: SpendIntent,
  history: readonly PastSpend[],
  now: number,
): Decision {
  const reasons: string[] = [];
  if (intent.amountSats <= 0n) return { decision: 'deny', reasons: ['Valor inválido.'] };
  if (intent.feeRate > policy.maxFeeRate) {
    return { decision: 'deny', reasons: [`Taxa ${intent.feeRate} sat/vB acima do máximo ${policy.maxFeeRate}.`] };
  }
  if (intent.origin === 'user') return { decision: 'allow', reasons: ['Ação direta do usuário.'] };

  if (!policy.agentEnabled) return { decision: 'deny', reasons: ['Operação por agente está desativada.'] };
  if (intent.amountSats > policy.maxPerTxSats) {
    return { decision: 'deny', reasons: ['Valor acima do limite por transação.'] };
  }
  const spent24h = history
    .filter((h) => now - h.at < DAY_MS && h.at <= now)
    .reduce((s, h) => s + h.amountSats, 0n);
  if (spent24h + intent.amountSats > policy.maxPer24hSats) {
    return { decision: 'deny', reasons: ['Limite acumulado de 24 h seria excedido.'] };
  }

  if (!policy.allowlist.includes(intent.to)) reasons.push('Destino fora da lista permitida.');
  if (intent.amountSats >= policy.approvalThresholdSats) reasons.push('Valor exige aprovação humana.');
  return reasons.length > 0 ? { decision: 'needs_approval', reasons } : { decision: 'allow', reasons: ['Dentro da política.'] };
}
