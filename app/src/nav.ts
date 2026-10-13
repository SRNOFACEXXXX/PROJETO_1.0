export type Route =
  | { name: 'welcome' }
  | { name: 'create' }
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
