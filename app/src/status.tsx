import { Banner } from './ui';

export type LoadStatus = 'loading' | 'ok' | 'retrying' | 'failed';

/**
 * Aviso de carga que nunca deixa o usuário sem saber o que acontece:
 * mostra o motivo, a contagem da próxima tentativa e que nada se perdeu.
 */
export function StatusBanner({
  status,
  error,
  retryIn,
  note,
}: {
  status: LoadStatus;
  error: string | null;
  retryIn: number;
  /** Frase tranquilizadora específica da tela. */
  note?: string;
}) {
  if (status === 'retrying') {
    return (
      <Banner kind="warn">
        {error} Nova tentativa em {retryIn}s.{note ? ` ${note}` : ''}
      </Banner>
    );
  }
  if (status === 'failed') {
    return (
      <Banner kind="danger">
        {error} Toque em "Tentar agora" quando a conexão voltar.
      </Banner>
    );
  }
  return null;
}
