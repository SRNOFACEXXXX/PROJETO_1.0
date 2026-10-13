# Análise do app BR Bit 2.2.0 (para espelhar no app novo)

**Fonte:** o APK instalado no celular (`com.brbit.wallet` 2.2.0), analisado de forma estática.
O código-fonte original foi perdido; o que segue vem de engenharia reversa do próprio app.

## Como foi analisado

| Camada | Ferramenta | Resultado |
|---|---|---|
| Android nativo (Java/Kotlin) | **REA** (JADX 0.7.1) | 16.294 classes, manifest, permissões (internet, biometria, scanner de QR) |
| JavaScript do app (React Native) | `hermes-dec` sobre o bundle Hermes v96 | 16.597 funções; telas e serviços localizados e lidos |

O REA não lê bytecode Hermes (leu 0 arquivos do bundle); por isso a camada JavaScript foi
decompilada à parte. O código decompilado está em forma de registradores, sem nomes de
variáveis: serve para entender o comportamento, não para copiar.

## Mapa de funcionalidades do app 2.2.0

| Área | O que o app 2.2.0 faz | App novo |
|---|---|---|
| Boas-vindas | "Sua carteira Bitcoin", Criar nova, Importar | ✅ |
| Criar carteira | 12 palavras BIP39 | ✅ + confirmação de 3 palavras (2.2.0 não tinha) |
| Importar | 12 campos de palavras; erro "Palavras Inválidas" com dica BIP39 em inglês; "Processando segurança… criptografando chaves" | ✅ campo único; ⬜ 12 campos |
| PIN | 6 dígitos, confirmação, "PINs não coincidem" | ✅ + bloqueio exponencial e regras de PIN fraco |
| Biometria | `canUseBiometricAuthentication` | ⬜ |
| Home | Saldo total; Enviar / Receber / Comprar; cartão Solana; transações recentes ("Ver todas", "Ver histórico completo"); cartão Lightning (pagamentos instantâneos) | ✅ saldo, Enviar/Receber; ⬜ histórico; ⬜ Solana; ⬜ Lightning |
| Enviar BTC | Valida endereço e valor; "Calcular taxa"; confirmação "Você está enviando X BTC para…"; sucesso | ✅ + revisão com taxa e PIN |
| Receber | QR, copiar, compartilhar, **gerar novo endereço**, **histórico de endereços**, alternar mainnet/testnet | ✅ QR/copiar; ⬜ compartilhar; ⬜ novo endereço; ⬜ histórico |
| Comprar BTC | Cotação em R$ via Bipa (mínimo R$ 10), expira em N segundos, pagamento PIX, "Simular pagamento" (integração **pendente** no 2.2.0) | ⬜ (no 2.2.0 era simulação) |
| Solana | Enviar e receber SOL, saldo SOL, preço SOL | ⬜ |
| Ajustes | Backup (ver as 12 palavras, marcado "em breve"), **servidor Electrum configurável**, "Manifesto BR Bit", "Sair da carteira" (reimportar com as 12 palavras) | ✅ rede, apagar; ⬜ backup com PIN; ⬜ servidor configurável; ⬜ manifesto |

## Pontos fracos encontrados no 2.2.0 (para não repetir)

- Textos com caracteres corrompidos ("Valor inv??lido", "endere??o") nas telas de Solana: erro de codificação do código-fonte.
- Backup da frase não implementado ("em breve"): quem perde o papel não tem como rever.
- Compra via PIX era uma simulação (`Integração pendente`), com botão "Simular pagamento".
- Chave da Bipa configurada em tempo de execução (`setApiKey`), sem tela clara de configuração.

## Prioridade sugerida para espelhar

1. **Histórico de transações** e **novo endereço de recebimento** (base de qualquer carteira).
2. **Backup da frase protegido por PIN** (resolve a pendência do 2.2.0).
3. **Biometria** ligada ao Keystore, não a um simples "ok".
4. **Mercados** com gráficos (pedido novo): preço, variação e candles.
5. **Servidor configurável** (privacidade) e **Solana**.
6. Comprar BTC (PIX): só depois de existir um provedor real.
