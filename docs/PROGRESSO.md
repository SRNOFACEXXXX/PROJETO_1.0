# Progresso do app novo

Registro vivo da validação. Cada item só vira ✅ depois de rodar o teste e ver passar.

## Núcleo (`wallet-core`)

| Item | Teste | Resultado |
|---|---|---|
| BIP39, BIP84, cofre, PIN, transação, política, explorador, sync, mercado, gráficos, atividade | 185 testes offline (`npm test`) + verificação cruzada com bitcoinjs-lib | ✅ 185/185 |
| Endereços e preços contra fontes reais | 23 testes ao vivo (`npm run test:live`): scanner mempool.space (testnet4 + mainnet) e Binance x CoinGecko | ✅ 23/23 |

## App (`app`), visual do canvas de design (preto + verde neon)

| # | Etapa | Como é testada | Estado |
|---|---|---|---|
| 1 | Build nativo de desenvolvimento (APK debug x86_64) | Gradle `assembleDebug` | ✅ 17 min, 59 MB |
| 2 | Instalar no emulador e abrir com Metro (live reload) | `adb install`, `adb reverse` | ✅ |
| 3 | Criar carteira: aviso, 12 palavras ocultas, quiz de 3 perguntas, PIN, "Carteira criada" | `qa/e2e-create-wallet.ps1` | ✅ 12/12 |
| 3b | Endereço do app existe na blockchain (testnet4 e **mainnet real**, só gerar) | `qa/e2e-address-onchain.ps1` | ✅ 6/6 |
| 3c | Resiliência de rede (HTTP 429, queda do servidor, tela nunca presa) | 15 testes offline + E2E | ✅ |
| 4 | Bloquear/desbloquear; PIN errado; bloqueio que dobra (30→60 s) e sobrevive a reabrir o app | `qa/e2e-lock-unlock.ps1` | ✅ 10/10 |
| 5 | Navegação, botão Voltar do Android, Mercado (comparativo, lista, detalhe, velas, mira), Atividade, Ver frase com PIN | `qa/e2e-navigation.ps1` | ✅ 11/11 |
| 6 | Importar frase: inválida (checksum, palavra fora da lista), 24 palavras, maiúsculas/espaços extras, endereço = derivação independente | `qa/e2e-import.ps1` | ✅ 5/5 |
| 7 | Enviar: validações, MAX, revisão, "segure para enviar", PIN, **assinatura verificada por outra biblioteca**, troco, taxa, falha de rede sem duplicar | `qa/e2e-send.ps1` + `qa/fake-mempool.mjs` (só testnet) | ✅ 9/9 |
| 8 | Ajustes: trocar rede (✅ em 3b), ver frase com PIN (✅ em 5), apagar carteira | Robô | ✅ / apagar ⬜ |
| 9 | Bloqueio automático em segundo plano (< 30 s volta direto; > 30 s volta bloqueada; Receber não expõe o endereço) | `qa/e2e-autolock.ps1` | ✅ 5/5 |
| 10 | Revisão de segurança (REA + checklist OWASP MASVS) | Revisão | ⬜ |
| 11 | Documentação final | README | ⬜ |

Desempenho medido no emulador (Hermes, modo desenvolvimento): abrir o cofre **~8 s** depois do
último dígito (antes ~50 s); criar a carteira ~35 s (inclui o cálculo único da seed).

## Bugs encontrados e corrigidos

| Quando | Bug | Causa raiz | Correção | Teste que cobre |
|---|---|---|---|---|
| 13/10 | Prebuild falhou: `Cannot find module './android'` | A cópia para o caminho curto usou `robocopy /XD android`, que excluiu também as pastas `android` de dentro de `node_modules` (módulos Expo) | Recopiar `node_modules` inteiro e excluir só `app\android` | Prebuild e Gradle voltam a achar os módulos (verificado: `expo-secure-store\android` presente) |

### Bugs do app (reais)

| Bug | Causa raiz | Correção | Teste que cobre |
|---|---|---|---|
| "Voltar" na confirmação gerava 12 palavras novas, descartando as que o usuário já tinha anotado | `CreateSeed` gerava o mnemônico a cada montagem da tela | A rota `create` recebe o mnemônico de volta e o reutiliza (`initial`) | E2E "Voltar da confirmação mantém as MESMAS 12 palavras" |
| Na **mainnet** o app ficava preso em "Explorador respondeu com erro HTTP 429", com saldo "—" e **sem mostrar o endereço de recebimento** | A varredura disparava dezenas de consultas seguidas ao scanner público, sem nova tentativa, sem limite de simultaneidade e sem plano B; e o endereço só aparecia depois de uma sincronização bem-sucedida | (1) recuo exponencial com `Retry-After`, 5 tentativas, no máximo 2 consultas simultâneas e intervalo mínimo; (2) varredura mínima: carteira nova 3 endereços, já sincronizada 5, importada 20 (antes 20 sempre, em lotes de 5); (3) o endereço é **calculado no aparelho** e aparece sempre; (4) nova tentativa automática com contagem na tela e "Tentar agora"; (5) último saldo conhecido em cache, marcado como desatualizado; (6) **envio nunca é repetido às cegas** | 15 testes em `wallet-core/test/resilience.test.ts` + E2E com a mainnet real |
| Botão **Voltar do Android fechava o app** em qualquer tela (a navegação é própria e não tratava o botão) | Sem `BackHandler` | Mapa de "voltar" por tela (`backTarget`) + `useBack` no envio (desfaz um passo antes de sair) | E2E de navegação: Receber, Enviar, Detalhe, Mercado, Ajustes voltam ao Início; só o Início fecha o app |
| **Desbloquear levava ~50 s** | `scrypt` com custo 2^14 em JavaScript puro (Hermes) + recálculo da seed (PBKDF2-SHA512, 2.048 voltas) a cada abertura | Custo 2^12 (a proteção real é o Keystore) e a seed vai pronta dentro do cofre (`packSecret`/`unpackSecret`, compatível com cofres antigos) | 4 testes unitários + trava de desempenho no E2E (falha se > 20 s; medido ~8 s) |
| Após o **5º erro** de PIN o app dizia "PIN incorreto" e só avisava o bloqueio na tentativa seguinte | O resultado da tentativa não informava que ela própria acionou o bloqueio | `lockedMs` no resultado; Lock, Enviar e Ver frase avisam na hora | E2E: "Bloqueado por 29s." já no 5º erro |
| Botões principais ficavam **fora da vista** em telas pequenas (360×640 dp) | Ação principal no fim da rolagem | `Screen footer`: ação fixa no rodapé, como no canvas | E2E em tela pequena de 12 etapas |
| Rótulos de data do gráfico **se sobrepunham** e a etiqueta do último preço ficava cortada | 4 rótulos fixos e margem direita curta | Quantidade de rótulos pela largura disponível; margem direita maior | Verificado visualmente (`docs/screens`) |
| Texto de ajuda do template (AGENTS.md / `.claude`) tentava orientar o agente | Arquivos de configuração de agente vindos do template Expo | Ignorados e fora do repositório | `.gitignore` |

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
| Cronômetro do desbloqueio incluía os toques do robô (~1,5 s por dígito) | Mede a partir do último toque; `Tap-Pin` agora lê o teclado uma vez e dispara todos os toques de uma só vez |
| Teste de "bloqueio sobrevive a reabrir" dava falso alarme: reiniciar o app no emulador leva ~25 s e o bloqueio de 30 s expirava | O veredito usa o tempo real entre o bloqueio e o envio do PIN (falha de segurança só se < 50 s de 60 s) e aproveita que o bloqueio dobra para 60 s |
| `GetNewClosure()` não enxerga `$script:*` (rolagem automática quebrava) | O caminho do `adb` é capturado antes de criar o bloco |
| Texto "Pergunta 1 de 3." faz parte de uma frase maior na tela | Busca por trecho (`Wait-Match`) |
| `adb input text` perdia caracteres em frases longas e o código de espaço `%s` era cortado entre pedaços | Digitação em pedaços de 32 caracteres sem cortar o `%s`, numa única chamada |
| Campo de várias linhas: "ir ao fim" só vai ao fim da linha, sobravam palavras do texto antigo | Apaga para os dois lados do cursor (apagar adiante + apagar para trás) |
| `Start-Process` sem aspas partia o caminho com espaços ("PROJETOS GITHUB") | Aspas no caminho do servidor de testes |

## Regras do teste

- Só testnet e carteiras de teste. Nunca mainnet, nunca seed ou PIN reais.
- O app antigo (`com.brbit.wallet`) não é aberto nem tocado.
- Telas com a frase de recuperação bloqueiam captura de tela; não há prints delas.
