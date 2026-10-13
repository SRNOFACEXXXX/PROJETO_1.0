# HotWallet BTC — BR Bit

Carteira cripto mobile (Bitcoin, Ethereum e Solana) em React Native / Expo.

Este repositório documenta a **recuperação** do app BR Bit (versão 2.2.0) e a
construção de uma carteira nova e limpa, com testes de QA e de segurança.

## Contexto

O código-fonte original da versão 2.2.0 foi perdido junto com o computador de
desenvolvimento. A única cópia dessa versão é o APK instalado no celular. O
repositório antigo no GitHub (`HotWalletApp_novo` 1.0.0) está bem atrás dessa
versão e não compila sozinho (falta `react-native-svg` no `package.json`).

## O que já foi feito

- Emulador Android leve (AOSP, sem apps Google, 2 GB de RAM) para testes — pasta [`emulador/`](emulador/).
- Clone e build do repositório antigo, com os problemas encontrados e corrigidos:
  dependência ausente e limite de 260 caracteres de caminho no Windows.
- Análise estática do APK 2.2.0 com o REA (JADX) e decompilação do bundle
  Hermes (bytecode v96, 16.597 funções) para mapear telas e serviços.

## Módulos identificados no app 2.2.0

| Área | Módulos |
|---|---|
| Telas | Welcome, CreateWallet, ImportWallet, Home, Send, Receive, Settings, BuyBitcoin, SendSol, ReceiveSol, Pin |
| Serviços | SecureWalletService, SecurityService, WalletService, SolanaWalletService, PriceService, BipaService |

## Próximos passos

1. Documentar o comportamento do app 2.2.0 tela por tela.
2. Design novo (moderno, com neon) para o portfólio.
3. Carteira nova e limpa: BIP39 / BIP32 / BIP84, armazenamento seguro, PIN e biometria.
4. Testes com os vetores públicos dos BIPs e revisão de segurança.
5. Preparar a carteira para operação assistida por um modelo Claude, com limites
   de valor, lista de endereços permitidos e aprovação humana antes de assinar.

## Emulador de teste

```powershell
powershell -ExecutionPolicy Bypass -File emulador\setup-emulador.ps1    # uma vez
powershell -ExecutionPolicy Bypass -File emulador\start-emulador.ps1 -Apk caminho\app.apk
```

## Segurança

Este repositório **não** contém seeds, PINs, chaves, keystores nem APKs.
O `.gitignore` bloqueia esses arquivos. Use apenas carteiras de teste nos
emuladores e nunca publique capturas de tela que mostrem uma seed.
