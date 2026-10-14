# Segurança: modelo, revisão e limites

**Estado:** versão de testes, **sem auditoria externa**. Rede padrão: testnet. Nada aqui é garantia; é o que foi
construído, o que foi medido e o que **ainda não está resolvido**.

## Revisão feita

| Técnica | O que foi feito | Resultado |
|---|---|---|
| Análise estática do APK com **REA (JADX)** | `inspect-android-package` no nosso próprio APK: manifest decodificado, permissões, componentes exportados | 5 achados de configuração (abaixo); todos resolvidos no release, reconferido com o REA |
| Revisão do código | busca por `console.*`, segredos fixos, hosts de rede, uso da área de transferência | nenhum log, nenhum segredo fixo, 3 hosts, clipboard só para copiar o endereço e colar o destino |
| Verificação cruzada de criptografia | derivação de endereços e assinaturas conferidas com `bitcoinjs-lib` (outra implementação) | idênticas; assinaturas ECDSA válidas, low-S, SIGHASH_ALL |
| Testes de ataque no núcleo | cofre adulterado, parâmetros de KDF maliciosos (negação de serviço), respostas hostis do servidor, injeção de caminho, endereço de outra rede | todos recusados (`wallet-core/test`) |
| Testes E2E de segurança no emulador | bloqueio de PIN persistente e exponencial, bloqueio automático, "Voltar" sem fechar dados, envio sem duplicar | passam (`qa/`) |

### Achados do REA no APK e destino

| # | Achado | Gravidade | Ação |
|---|---|---|---|
| 1 | `allowBackup="true"` | média | **Corrigido**: `withHardenedManifest` força `false` |
| 2 | Provedor de arquivos exportado (`ClipboardFileProvider`, do `expo-clipboard`) | média | **Corrigido**: removido no merge do manifest (só usamos texto) |
| 3 | Permissões `READ/WRITE_EXTERNAL_STORAGE` e `USE_FINGERPRINT` sem uso | baixa | **Corrigido**: bloqueadas em `app.json` |
| 4 | `debuggable="true"` e `usesCleartextTraffic="true"` | alta se fosse release | **Só no APK de desenvolvimento.** Reconferido no APK **release** com o REA: `debuggable` ausente (falso), `usesCleartextTraffic="false"`, `allowBackup="false"` |
| 5 | `SYSTEM_ALERT_WINDOW` | baixa | **Corrigido.** Vinha do template do Expo, no manifest principal (não só no de debug). Bloqueada em `app.json`; ausente no release (REA) |

### APK release (arm64) para o celular

Gerado com JavaScript embutido (não depende de servidor), só `arm64-v8a`, assinado com chave própria guardada fora do repositório. Permissões finais: `INTERNET`, `USE_BIOMETRIC`, `VIBRATE`, `DETECT_SCREEN_CAPTURE`. `USE_BIOMETRIC` vem de uma biblioteca e o app ainda não usa biometria.

## Mapa OWASP MASVS

| Área | Controle | Evidência |
|---|---|---|
| **Armazenamento** | Seed só dentro de um cofre `scrypt` + XChaCha20-Poly1305, guardado no SecureStore (Keystore). Nunca em variável de módulo, log ou backup | `vault.ts`, `session.ts`, plugin do manifest |
| | Frase nunca vai para a área de transferência; sem botão de copiar | `Onboarding.tsx` |
| | Captura e gravação de tela bloqueadas na frase, no quiz, no PIN e em "Ver frase" | `expo-screen-capture` (`FLAG_SECURE`) |
| **Criptografia** | Bibliotecas auditadas, JavaScript puro (`@scure`/`@noble`); aleatoriedade do sistema | vetores BIP39/BIP84 + verificação cruzada |
| | Cofre autenticado: erro de PIN e adulteração falham do mesmo jeito | `vault-pin.test.ts` |
| **Autenticação** | PIN de 6 dígitos com regras (sem sequência/repetição/comum) | `pin.ts` |
| | Bloqueio exponencial persistente (30 s, 60 s, ...), apagamento no limite, contador sobrevive a reabrir o app | `e2e-lock-unlock.ps1` |
| | PIN exigido para enviar e para ver a frase; envio exige "segurar" 1,2 s | `Send.tsx`, `Settings.tsx` |
| | Bloqueio automático após 30 s em segundo plano; a tela de bloqueio não mostra dados | `e2e-autolock.ps1` |
| **Rede** | Só HTTPS no release; respostas validadas campo a campo; recuo exponencial com `Retry-After` | `http.ts`, `explorer.ts`, `resilience.test.ts` |
| | Envio **nunca é repetido às cegas** (uma falha no meio pode já ter transmitido) | `e2e-send.ps1` |
| **Plataforma** | Componentes exportados mínimos; permissões mínimas; backup desligado | REA + `withHardenedManifest` |
| **Código** | Sem logs, sem segredos fixos, TypeScript estrito, 185 testes offline + 23 ao vivo | revisão + CI local |
| **Privacidade** | Sem analytics nem rastreadores. Preços: nenhum dado da carteira vai à Binance | `market.ts` |

## O que NÃO está resolvido (leia antes de usar com dinheiro)

1. **PIN de 6 dígitos não resiste a ataque offline sozinho.** Com um aparelho comprometido (root) e o cofre extraído, 10^6 PINs
   caem rápido. A defesa real é o Keystore/Keychain (hardware), que guarda o cofre. A **biometria ligada ao Keystore** ainda
   não existe; hoje o app não usa biometria.
2. **Privacidade de endereços.** Cada consulta ao mempool.space revela ao servidor o seu IP e os endereços da carteira
   (vinculáveis entre si). A solução é um servidor próprio/Electrum configurável (o app 2.2.0 tinha); **não implementado**.
3. **Sem fixação de certificado (pinning).** Um servidor de confiança comprometido, ou uma AC maliciosa no aparelho,
   poderia mentir sobre saldos (não consegue assinar nada, mas pode induzir erro). O envio sempre mostra os valores
   antes de assinar.
4. **JavaScript não garante apagar a memória.** `lock()` e o `fill(0)` das chaves são melhor esforço.
5. **Sem detecção de root, emulador ou hooking.** Não é objetivo desta versão.
6. **Sem RBF/CPFP**: uma transação com taxa baixa pode ficar presa.
7. **Nunca foi usado na mainnet com fundos.** A mainnet só foi usada para gerar e validar endereços descartáveis.
8. **O agente Claude** (`evaluateSpend`) está testado no núcleo, mas **ainda não está ligado à interface**.
9. **Sem auditoria externa.**

## Como reproduzir esta revisão

```powershell
$env:REA_JADX_MCP_JAR='...\jadx-headless-mcp-0.7.1-all.jar'; $env:JAVA_HOME='...\jdk'
rea inspect-android-package app-release.apk --json     # manifest, permissões, componentes exportados
cd wallet-core; npm test; npm run test:live              # núcleo + validação contra a blockchain real
powershell -File qa\e2e-lock-unlock.ps1                  # controles de PIN e bloqueio no emulador
```
