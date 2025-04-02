import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import * as bip39 from 'bip39';

// Interface para representar uma carteira
export interface Wallet {
  id: string;
  name: string;
  symbol: string;
  address: string;
  balance: number;
  value: number;
  change24h: number;
  icon: string;
  privateKey?: string; // Armazenado de forma segura na prática
}

// Interface para transação
export interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  coin: string;
  date: string;
  address: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  fee?: number;
  txHash?: string;
}

// Classe de serviço para operações de carteira
class WalletService {
  private wallets: Wallet[] = [];
  private transactions: Transaction[] = [];
  private seedPhrase: string | null = null;
  private isInitialized: boolean = false;

  // Inicializar o serviço
  public async initialize(): Promise<boolean> {
    // Em um app real, aqui recuperaríamos as carteiras salvas
    // e verificaríamos se o usuário já possui uma carteira configurada
    if (!this.isInitialized) {
      this.createMockWallets();
      this.createMockTransactions();
      this.isInitialized = true;
    }
    return this.isInitialized;
  }

  // Gerar nova frase de recuperação
  public generateSeedPhrase(): string {
    try {
      // Usar bip39 para gerar uma frase mnemônica de 12 palavras
      const mnemonic = bip39.generateMnemonic(128); // 128 bits = 12 palavras
      this.seedPhrase = mnemonic;
      return mnemonic;
    } catch (error) {
      console.error('Erro ao gerar frase de recuperação:', error);
      // Em caso de erro, usar uma abordagem alternativa
      const fallbackPhrase = 'mango apple banana orange grape lemon peach cherry kiwi melon pear strawberry blueberry';
      this.seedPhrase = fallbackPhrase;
      return fallbackPhrase;
    }
  }

  // Restaurar carteira a partir de uma frase de recuperação
  public restoreFromSeedPhrase(seedPhrase: string): boolean {
    try {
      // Validar a frase de recuperação
      if (!bip39.validateMnemonic(seedPhrase)) {
        console.error('Frase de recuperação inválida');
        return false;
      }

      this.seedPhrase = seedPhrase;
      
      // Aqui seria implementada a lógica real para derivar as chaves e endereços
      // de diferentes blockchains a partir da semente
      
      // Simulação: criar carteiras simuladas
      this.createMockWallets();
      this.createMockTransactions();
      this.isInitialized = true;
      
      return true;
    } catch (error) {
      console.error('Erro ao restaurar carteira:', error);
      return false;
    }
  }

  // Criar carteiras simuladas para demonstração
  private createMockWallets(): void {
    this.wallets = [
      {
        id: '1',
        name: 'Bitcoin',
        symbol: 'BTC',
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        balance: 0.0025,
        value: 125.34,
        change24h: 2.45,
        icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=025'
      },
      {
        id: '2',
        name: 'Ethereum',
        symbol: 'ETH',
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        balance: 0.15,
        value: 350.78,
        change24h: 3.21,
        icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=025'
      },
      {
        id: '3',
        name: 'Solana',
        symbol: 'SOL',
        address: '9ZNmBLQdCkE6mqZQkEi3MYwRcQs2GjLGSvBL7jvGrVxU',
        balance: 3.5,
        value: 189.23,
        change24h: -1.15,
        icon: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=025'
      },
    ];
  }

  // Criar transações simuladas para demonstração
  private createMockTransactions(): void {
    this.transactions = [
      {
        id: '1',
        type: 'receive',
        amount: 0.0025,
        coin: 'BTC',
        date: '2023-03-28',
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        status: 'completed',
        timestamp: Date.now() - 24 * 60 * 60 * 1000,
        fee: 0.0001,
        txHash: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      },
      {
        id: '2',
        type: 'send',
        amount: 0.05,
        coin: 'ETH',
        date: '2023-03-25',
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        status: 'completed',
        timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
        fee: 0.001,
        txHash: '0x8723d5C6634C0532925a3b844Bc454e4438f321'
      },
      {
        id: '3',
        type: 'receive',
        amount: 2.5,
        coin: 'SOL',
        date: '2023-03-20',
        address: '9ZNmBLQdCkE6mqZQkEi3MYwRcQs2GjLGSvBL7jvGrVxU',
        status: 'completed',
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
        fee: 0.00005,
        txHash: '9ZNmBLQdCkE6mqZQkEi3MYwRcQs2GjLGSvBL7jvGrVxU'
      },
    ];
  }

  // Obter todas as carteiras
  public getWallets(): Wallet[] {
    return this.wallets;
  }

  // Obter carteira específica por símbolo
  public getWalletBySymbol(symbol: string): Wallet | undefined {
    return this.wallets.find(wallet => wallet.symbol === symbol);
  }

  // Obter carteira específica por ID
  public getWalletById(id: string): Wallet | undefined {
    return this.wallets.find(wallet => wallet.id === id);
  }

  // Obter todas as transações
  public getTransactions(): Transaction[] {
    return this.transactions;
  }

  // Obter transações específicas por símbolo da moeda
  public getTransactionsByCoin(coin: string): Transaction[] {
    return this.transactions.filter(transaction => transaction.coin === coin);
  }

  // Enviar transação (simulado)
  public async sendTransaction(
    fromSymbol: string,
    toAddress: string,
    amount: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Verificar se a carteira existe
      const wallet = this.getWalletBySymbol(fromSymbol);
      if (!wallet) {
        return { success: false, error: 'Carteira não encontrada' };
      }

      // Verificar saldo
      if (wallet.balance < amount) {
        return { success: false, error: 'Saldo insuficiente' };
      }

      // Simular um pequeno atraso para parecer real
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Atualizar saldo (simulado)
      wallet.balance -= amount;

      // Gerar hash de transação simulado
      const txHash = `tx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

      // Adicionar transação ao histórico
      const newTransaction: Transaction = {
        id: `tx_${Date.now()}`,
        type: 'send',
        amount: amount,
        coin: wallet.symbol,
        date: new Date().toISOString().split('T')[0],
        address: toAddress,
        status: 'completed',
        timestamp: Date.now(),
        fee: amount * 0.01, // 1% de taxa (simulado)
        txHash: txHash
      };

      this.transactions.unshift(newTransaction);

      return { success: true, txHash };
    } catch (error) {
      console.error('Erro ao enviar transação:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar transação' 
      };
    }
  }

  // Gerar endereço de recebimento para uma carteira
  public getReceiveAddress(symbol: string): string | null {
    const wallet = this.getWalletBySymbol(symbol);
    return wallet ? wallet.address : null;
  }

  // Simular recebimento de fundos (para demonstração)
  public simulateReceiveFunds(symbol: string, amount: number): boolean {
    try {
      const wallet = this.getWalletBySymbol(symbol);
      if (!wallet) return false;

      // Atualizar saldo
      wallet.balance += amount;

      // Adicionar transação ao histórico
      const newTransaction: Transaction = {
        id: `tx_${Date.now()}`,
        type: 'receive',
        amount: amount,
        coin: wallet.symbol,
        date: new Date().toISOString().split('T')[0],
        address: wallet.address,
        status: 'completed',
        timestamp: Date.now(),
        txHash: `rx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
      };

      this.transactions.unshift(newTransaction);

      return true;
    } catch (error) {
      console.error('Erro ao simular recebimento:', error);
      return false;
    }
  }

  // Calcular valor total da carteira
  public getTotalBalance(): number {
    return this.wallets.reduce((total, wallet) => total + wallet.value, 0);
  }

  // Verificar se já existe uma carteira configurada
  public hasWallet(): boolean {
    return this.wallets.length > 0;
  }

  // Limpar todas as carteiras (usado ao fazer logout)
  public clearWallets(): void {
    this.wallets = [];
    this.transactions = [];
    this.seedPhrase = null;
    this.isInitialized = false;
  }
}

// Exportar uma instância única do serviço (singleton)
export const walletService = new WalletService();

export default walletService; 