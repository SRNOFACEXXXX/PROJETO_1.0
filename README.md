# Hot Wallet App

Aplicativo de carteira multi-blockchain desenvolvido em React Native.

## Descrição

O Hot Wallet App é uma carteira digital para armazenamento e gerenciamento de criptomoedas, desenvolvida com React Native e Expo. Esse aplicativo permite criar e restaurar carteiras, enviar e receber transações, e gerenciar múltiplas criptomoedas de forma segura.

## Características

- **Onboarding intuitivo**: Fluxo de introdução que explica as funcionalidades da carteira
- **Criação e Restauração de Carteira**: Usando frases de recuperação de 12 palavras (seed phrases)
- **Carteira Multi-blockchain**: Suporte para Bitcoin, Ethereum e Solana
- **Envio e Recebimento**: Transferência de criptomoedas com geração de código QR
- **Dashboard Informativo**: Visão geral de todos os ativos e transações recentes
- **Configurações Personalizáveis**: Opções de segurança e preferências do usuário

## Requisitos de Sistema

- Node.js 18+
- Expo CLI
- React Native Environment

## Instalação

1. Clone o repositório
```bash
git clone [url-do-repositorio]
cd HotWalletApp
```

2. Instale as dependências
```bash
npm install
```

3. Execute o aplicativo
```bash
npx expo start
```

## Estrutura do Projeto

```
HotWalletApp/
│
├── assets/                  # Imagens e recursos estáticos
│
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │
│   ├── navigation/          # Configuração de navegação
│   │   └── AppNavigator.tsx # Navegador principal do aplicativo
│   │
│   ├── screens/             # Telas do aplicativo
│   │   ├── OnboardingScreen.tsx  # Tela de introdução
│   │   ├── CreateWalletScreen.tsx  # Criação de nova carteira
│   │   ├── RestoreWalletScreen.tsx # Restauração de carteira existente
│   │   ├── SeedPhraseScreen.tsx    # Exibição da frase de recuperação
│   │   ├── DashboardScreen.tsx     # Tela principal com saldo e transações
│   │   ├── TransactionScreen.tsx   # Envio e recebimento de criptomoedas
│   │   └── SettingsScreen.tsx      # Configurações do aplicativo
│   │
│   ├── services/            # Serviços e APIs
│   │   └── walletService.ts # Serviço de gerenciamento de carteiras
│   │
│   └── utils/               # Utilitários e funções auxiliares
│       └── polyfills.ts     # Polyfills para compatibilidade
│
├── App.tsx                  # Componente raiz do aplicativo
├── package.json             # Dependências e scripts
└── README.md                # Documentação
```

## Fluxo do Aplicativo

1. **Onboarding**: O usuário é recebido com uma introdução às características da carteira.
2. **Criação/Restauração de Carteira**: O usuário pode criar uma nova carteira ou restaurar uma existente com uma frase de recuperação.
3. **Backup de Frase de Recuperação**: Para novas carteiras, o usuário é guiado a fazer backup da frase de recuperação de 12 palavras.
4. **Dashboard**: Após configuração, o usuário é direcionado ao dashboard que mostra saldos e transações.
5. **Transações**: O usuário pode enviar criptomoedas para outros endereços ou gerar códigos QR para recebimento.
6. **Configurações**: O usuário pode ajustar preferências, fazer backup, ou remover a carteira.

## Tecnologias Utilizadas

- **React Native**: Framework para desenvolvimento de aplicativos móveis
- **Expo**: Plataforma para desenvolvimento e distribuição de aplicativos React Native
- **React Navigation**: Biblioteca para navegação entre telas
- **Bibliotecas Criptográficas**: Para geração segura de carteiras e transações
- **AsyncStorage**: Para armazenamento local seguro

## Segurança

- Frases de recuperação nunca são armazenadas no dispositivo
- Implementação de verificações de segurança para transações
- Opções para proteção adicional com biometria ou PIN

## Estado de Desenvolvimento

Este aplicativo é um protótipo funcional que demonstra a viabilidade e a experiência do usuário de uma carteira de criptomoedas. Em um ambiente de produção, seriam necessárias implementações adicionais de segurança, testes extensivos e integração completa com as redes blockchain.

## Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Crie um Pull Request

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes. 