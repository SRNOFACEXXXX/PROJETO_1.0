export type Route =
  | { name: 'welcome' }
  /** Aviso sobre a frase de recuperação (etapa 1/4 da criação). */
  | { name: 'aviso' }
  /** `mnemonic` existe quando o usuário volta da confirmação: mantém as mesmas palavras. */
  | { name: 'create'; mnemonic?: string }
  | { name: 'confirm'; mnemonic: string }
  | { name: 'setpin'; mnemonic: string; isNew: boolean }
  | { name: 'ready'; isNew: boolean }
  | { name: 'import' }
  | { name: 'lock' }
  | { name: 'home' }
  | { name: 'receive' }
  | { name: 'send' }
  | { name: 'settings' }
  | { name: 'viewkey' }
  | { name: 'markets' }
  | { name: 'market'; symbol: string }
  | { name: 'activity' };

export interface Nav {
  go(route: Route): void;
}

/**
 * Para onde o botão Voltar do Android leva em cada tela. `null` = deixa o sistema decidir
 * (sair do app), o que só acontece nas telas raiz: boas-vindas, bloqueio e Início.
 */
export function backTarget(r: Route): Route | null {
  switch (r.name) {
    case 'aviso':
    case 'import':
      return { name: 'welcome' };
    case 'create':
      return { name: 'aviso' };
    case 'confirm':
      return { name: 'create', mnemonic: r.mnemonic };
    case 'setpin':
      return r.isNew ? { name: 'confirm', mnemonic: r.mnemonic } : { name: 'import' };
    case 'ready':
    case 'receive':
    case 'send':
    case 'markets':
    case 'activity':
    case 'settings':
      return { name: 'home' };
    case 'viewkey':
      return { name: 'settings' };
    case 'market':
      return { name: 'markets' };
    default:
      return null;
  }
}
