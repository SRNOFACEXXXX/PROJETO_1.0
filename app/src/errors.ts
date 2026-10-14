import { HttpError, RateLimitedError } from '@brbit/wallet-core';

/** Mensagem curta e sem detalhes técnicos para mostrar ao usuário. */
export function friendlyError(e: unknown): string {
  if (e instanceof RateLimitedError) return 'O servidor está ocupado (limite de requisições).';
  if (e instanceof HttpError) return e.message;
  return 'Não foi possível carregar agora.';
}
