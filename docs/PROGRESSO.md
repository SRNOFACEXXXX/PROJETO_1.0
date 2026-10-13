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
| 3b | Endereço do app existe na blockchain (testnet4 e **mainnet real**, só gerar) | `qa/e2e-address-onchain.ps1` + `wallet-core/test-live` (11 testes ao vivo) | ✅ 6/6 e 11/11 |
| 3c | Resiliência de rede (HTTP 429, queda do servidor, tela nunca presa) | 15 testes offline novos + E2E | ✅ |
| 4 | Bloquear / desbloquear; PIN errado com bloqueio exponencial | `qa/e2e-lock-unlock.ps1` | ⬜ escrito, falta rodar |
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

| Na **mainnet** o app ficava preso em "Explorador respondeu com erro HTTP 429", com saldo "—" e **sem mostrar o endereço de recebimento** | A varredura disparava dezenas de consultas seguidas ao scanner público, sem nova tentativa, sem limite de simultaneidade e sem plano B; e o endereço só aparecia depois de uma sincronização bem-sucedida | (1) recuo exponencial com `Retry-After`, 5 tentativas, no máximo 2 consultas simultâneas e intervalo mínimo; (2) varredura mínima: carteira nova 3 endereços, já sincronizada 5, importada 20 (antes 20 sempre, em lotes de 5); (3) o endereço é **calculado no aparelho** e aparece sempre; (4) nova tentativa automática com contagem na tela e "Tentar agora"; (5) último saldo conhecido em cache, marcado como desatualizado; (6) **envio nunca é repetido às cegas** | 15 testes em `wallet-core/test/resilience.test.ts` + E2E com a mainnet real |

### Bugs do robô de teste (não do app)

| Bug | Correção |
|---|---|
| Acentos não casavam (PowerShell 5.1 lê UTF-8 sem BOM como ANSI) | Scripts salvos com BOM e saída do adb decodificada em UTF-8 |
| Procurava "Palavra nº" mas a tela mostra "PALAVRA Nº" (maiúsculas) | Regex sem diferenciar maiúsculas |
| Botão escondido pelo teclado era lido como "habilitado" | Esconde o teclado, rola a tela e **falha** se não achar o botão |
| Após "Voltar", o app sorteia 3 posições novas e o teste usava as antigas | Relê os campos ao reabrir a confirmação |
| O teste esperava 90 s olhando uma tela de erro | **Vigia** (`Wait-Until`): mensagem de erro conhecida na tela falha na hora; tela parada falha; diálogo "não responde" do Android é dispensado sozinho; toda falha grava diagnóstico (tela, foco, log do app, Metro) em `qa/out/`, sem nunca gravar a frase secreta |
| Procurava "Saldo disponível" para saber se estava na Home, mas o texto muda com o estado da rede | Marcador estável: botões "Bloquear" + "Ajustes" |
| `npm test` também rodava os testes que usam a internet | `vitest.config.ts` separa: `npm test` (offline, 80) e `npm run test:live` (scanner, 11) |
| Endereço testnet do vetor BIP84 lembrado de cabeça estava errado (checksum inválido) | O scanner pegou; valor correto vem da derivação, nunca da memória |

## Regras do teste

- Só testnet e carteiras de teste. Nunca mainnet, nunca seed ou PIN reais.
- O app antigo (`com.brbit.wallet`) não é aberto nem tocado.
- Telas com a frase de recuperação bloqueiam captura de tela; não há prints delas.
