# Progresso do app novo

Registro vivo da validação. Cada item só vira ✅ depois de rodar o teste e ver passar.

## Núcleo (`wallet-core`)

| Item | Teste | Resultado |
|---|---|---|
| BIP39, BIP84, cofre, PIN, transação, política, explorador, sync | 65 testes unitários + verificação cruzada com bitcoinjs-lib | ✅ 65/65 |

## App (`app`)

| # | Etapa | Como é testada | Estado |
|---|---|---|---|
| 1 | Build nativo de desenvolvimento (APK debug x86_64) | Gradle `assembleDebug` | ✅ 17 min, 59 MB |
| 2 | Instalar no emulador e abrir com Metro (live reload) | `adb install`, `adb reverse`, tela inicial visível | ✅ |
| 3 | Criar carteira: 12 palavras, confirmar 3, PIN | `qa/e2e-create-wallet.ps1` (16 etapas) | ✅ 16/16 |
| 4 | Bloquear / desbloquear; PIN errado com bloqueio exponencial | Robô | ⬜ |
| 5 | Importar frase (válida e inválida) | Robô | ⬜ |
| 6 | Home, Receber com QR, copiar endereço | Robô | ⬜ |
| 7 | Enviar: validações, revisão, PIN, saldo insuficiente | Robô | ⬜ |
| 8 | Ajustes: trocar rede, apagar carteira | Robô | ⬜ |
| 9 | Bloqueio automático em segundo plano | Robô | ⬜ |
| 10 | Revisão de segurança (REA + checklist OWASP MASVS) | Revisão | ⬜ |
| 11 | Documentação final | README | ⬜ |

## Bugs encontrados e corrigidos

| Quando | Bug | Causa raiz | Correção | Teste que cobre |
|---|---|---|---|---|
| 13/10 | Prebuild falhou: `Cannot find module './android'` | A cópia para o caminho curto usou `robocopy /XD android`, que excluiu também as pastas `android` de dentro de `node_modules` (módulos Expo) | Recopiar `node_modules` inteiro e excluir só `app\android` | Prebuild e Gradle voltam a achar os módulos (verificado: `expo-secure-store\android` presente) |

### Bugs do app (reais)

| Bug | Causa raiz | Correção | Teste que cobre |
|---|---|---|---|
| "Voltar" na confirmação gerava 12 palavras novas, descartando as que o usuário já tinha anotado | `CreateSeed` gerava o mnemônico a cada montagem da tela | A rota `create` recebe o mnemônico de volta e o reutiliza (`initial`) | E2E "Voltar da confirmação mantém as MESMAS 12 palavras" |

### Bugs do robô de teste (não do app)

| Bug | Correção |
|---|---|
| Acentos não casavam (PowerShell 5.1 lê UTF-8 sem BOM como ANSI) | Scripts salvos com BOM e saída do adb decodificada em UTF-8 |
| Procurava "Palavra nº" mas a tela mostra "PALAVRA Nº" (maiúsculas) | Regex sem diferenciar maiúsculas |
| Botão escondido pelo teclado era lido como "habilitado" | Esconde o teclado, rola a tela e **falha** se não achar o botão |
| Após "Voltar", o app sorteia 3 posições novas e o teste usava as antigas | Relê os campos ao reabrir a confirmação |

## Regras do teste

- Só testnet e carteiras de teste. Nunca mainnet, nunca seed ou PIN reais.
- O app antigo (`com.brbit.wallet`) não é aberto nem tocado.
- Telas com a frase de recuperação bloqueiam captura de tela; não há prints delas.
