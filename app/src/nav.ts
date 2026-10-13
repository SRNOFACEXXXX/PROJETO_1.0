export type Route =
  | { name: 'welcome' }
  /** `mnemonic` existe quando o usuário volta da confirmação: mantém as mesmas palavras. */
  | { name: 'create'; mnemonic?: string }
  | { name: 'confirm'; mnemonic: string }
  | { name: 'setpin'; mnemonic: string }
  | { name: 'import' }
  | { name: 'lock' }
  | { name: 'home' }
  | { name: 'receive' }
  | { name: 'send' }
  | { name: 'settings' };

export interface Nav {
  go(route: Route): void;
}
