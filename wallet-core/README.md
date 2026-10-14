# @brbit/wallet-core

Núcleo puro e testável da carteira BR Bit. Sem dependência de React Native,
de Node ou do sistema de arquivos: roda em Node, no navegador e no Hermes.

**Status:** 65 testes passando, typecheck estrito limpo. Rede padrão: **testnet**.

## O que faz

| Módulo | Função |
|---|---|
| `mnemonic` | Gera e valida frases BIP39 (12 ou 24 palavras) e deriva a seed |
| `keys` | Chaves HD BIP32/BIP84 (Native SegWit `bc1q…` / `tb1q…`), recebimento e troco |
| `vault` | Cofre da seed: scrypt + XChaCha20-Poly1305 (cifra autenticada) |
| `pin` | Regras de PIN e bloqueio exponencial contra força bruta, com apagamento |
| `tx` | Seleção de moedas, taxa, troco, montagem e assinatura de transação (PSBT/P2WPKH) |
| `explorer` | Cliente do mempool.space com validação rígida das respostas |
| `sync` | Varredura BIP44 com limite de lacuna (gap limit 20) |
| `policy` | Política de gastos para um agente (Claude): limites, lista permitida e aprovação humana |

## Bibliotecas (todas do mesmo mantenedor, auditadas, JavaScript puro)

`@scure/bip39`, `@scure/bip32`, `@scure/btc-signer`, `@noble/hashes`,
`@noble/ciphers`, `@noble/curves`. Sem WASM e sem polyfill de `Buffer`.

## Como os testes garantem a corretude

- Vetores públicos: BIP39 (seed do mnemônico `abandon … about` com passphrase `TREZOR`) e BIP84.
- **Verificação cruzada** com `bitcoinjs-lib` + `bip32` + `tiny-secp256k1`
  (implementação independente): mesmos endereços em mnemônicos aleatórios, e
  **validação criptográfica de cada assinatura** (ECDSA, low-S, sighash BIP143).
- Segurança: cofre adulterado, parâmetros de KDF maliciosos, PIN fraco,
  respostas hostis do explorador, injeção de caminho em endereço, endereço da rede errada.

```bash
npm install
npm test          # 65 testes
npm run typecheck
```

## Operação por agente (Claude)

`evaluateSpend` devolve `allow`, `needs_approval` ou `deny`. O padrão é **negar
tudo**: o agente fica desligado até ser habilitado, e mesmo habilitado a
política limita valor por transação, valor em 24 h, taxa e destinos. O agente
só **propõe**; a assinatura exige a carteira desbloqueada com o PIN do usuário.

## Modelo de ameaças e limites (leia antes de usar com dinheiro real)

1. **PIN curto não basta contra ataque offline.** O cofre usa scrypt, mas 10^6
   PINs de 6 dígitos são rápidos de testar se alguém extrair o cofre do
   aparelho. No app, o cofre deve ficar no Android Keystore / iOS Keychain
   (hardware), que impede a extração, e a biometria deve estar ligada à chave
   do Keystore (não a um simples "ok" do callback). Esta camada ainda será
   implementada no app e **não faz parte deste pacote**.
2. **JavaScript não garante apagar memória.** `lock()` e o `fill(0)` das chaves
   são melhor esforço; o coletor de lixo pode manter cópias.
3. **Nunca foi usado na mainnet.** Teste na testnet4 com valores sem valor real
   antes de qualquer outra coisa. Falta ainda um teste de ponta a ponta contra a
   rede testnet real (precisa de fundos de faucet).
4. **Sem revisão de segurança externa.** Os testes são extensos, mas isso não
   substitui uma auditoria independente.
5. **Só Bitcoin por enquanto.** Ethereum e Solana (presentes no app 2.2.0) ainda
   não foram portados.
6. **Sem RBF/CPFP, sem PSBT de terceiros, sem hardware wallet.**
