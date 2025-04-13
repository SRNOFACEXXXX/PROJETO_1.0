import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useFocusEffect } from '@react-navigation/native';
import walletService from '../services/walletService';

type DashboardScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

const { width } = Dimensions.get('window');

// Dados simulados para o exemplo
const mockWallets = [
  { id: '1', name: 'Bitcoin', symbol: 'BTC', balance: 0.0025, value: 125.34, icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=025' },
  { id: '2', name: 'Ethereum', symbol: 'ETH', balance: 0.15, value: 350.78, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=025' },
  { id: '3', name: 'Solana', symbol: 'SOL', balance: 3.5, value: 189.23, icon: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=025' },
];

const mockTransactions = [
  { id: '1', type: 'receive', amount: 0.0025, coin: 'BTC', date: '2023-03-28', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', status: 'completed' },
  { id: '2', type: 'send', amount: 0.05, coin: 'ETH', date: '2023-03-25', address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', status: 'completed' },
  { id: '3', type: 'receive', amount: 2.5, coin: 'SOL', date: '2023-03-20', address: '9ZNmBLQdCkE6mqZQkEi3MYwRcQs2GjLGSvBL7jvGrVxU', status: 'completed' },
];

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const [wallets, setWallets] = useState(mockWallets);
  const [transactions, setTransactions] = useState(mockTransactions);
  const [totalBalance, setTotalBalance] = useState<number>(665.35); 
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Simular uma chamada de API para buscar os dados da carteira e transações
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      // Simular um atraso de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Em um aplicativo real, aqui faríamos a chamada para o serviço de carteira
      // const fetchedWallets = walletService.getWallets();
      // setWallets(fetchedWallets);
      
      // Calcular o saldo total
      const total = wallets.reduce((sum, wallet) => sum + wallet.value, 0);
      setTotalBalance(total);
      
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar dados da carteira:', error);
      setLoading(false);
    }
  };

  // Usar useFocusEffect para recarregar os dados quando a tela receber foco
  useFocusEffect(
    useCallback(() => {
      fetchWalletData();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  }, []);

  const handleSendPress = () => {
    navigation.navigate('Transaction', { type: 'send' });
  };

  const handleReceivePress = () => {
    navigation.navigate('Transaction', { type: 'receive' });
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const renderWalletItem = ({ item }: { item: typeof mockWallets[0] }) => (
    <TouchableOpacity 
      style={styles.walletCard}
      onPress={() => navigation.navigate('Transaction', { type: 'send', currency: item.symbol })}
    >
      <View style={styles.walletIconContainer}>
        <Image
          source={{ uri: item.icon }}
          style={styles.walletIcon}
          resizeMode="contain"
        />
      </View>
      <View style={styles.walletInfo}>
        <Text style={styles.walletName}>{item.name}</Text>
        <Text style={styles.walletBalance}>{item.balance} {item.symbol}</Text>
      </View>
      <View style={styles.walletValue}>
        <Text style={styles.walletValueText}>${item.value.toFixed(2)}</Text>
        <Text style={styles.walletChangeText}>+2.5%</Text>
      </View>
    </TouchableOpacity>
  );

  const renderTransactionItem = ({ item }: { item: typeof mockTransactions[0] }) => (
    <TouchableOpacity 
      style={styles.transactionItem}
      onPress={() => Alert.alert('Detalhes da Transação', `ID: ${item.id}\nEndereço: ${item.address}\nStatus: ${item.status}`)}
    >
      <View style={styles.transactionIconContainer}>
        <View style={[
          styles.transactionIcon, 
          item.type === 'receive' ? styles.receiveIcon : styles.sendIcon
        ]}>
          <Text style={styles.transactionIconText}>
            {item.type === 'receive' ? '↓' : '↑'}
          </Text>
        </View>
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionTitle}>
          {item.type === 'receive' ? 'Recebido' : 'Enviado'}
        </Text>
        <Text style={styles.transactionDate}>{item.date}</Text>
      </View>
      <View style={styles.transactionAmount}>
        <Text style={[
          styles.transactionAmountText,
          item.type === 'receive' ? styles.receiveText : styles.sendText
        ]}>
          {item.type === 'receive' ? '+' : '-'}{item.amount} {item.coin}
        </Text>
        <Text style={styles.transactionValueText}>
          ${item.type === 'receive' 
              ? (item.amount * 35000).toFixed(2) 
              : (-item.amount * 35000).toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Nenhuma transação encontrada</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá!</Text>
        <TouchableOpacity onPress={handleSettingsPress}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor={'#007AFF'}
          />
        }
      >
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Saldo Total</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.balanceValue}>${totalBalance.toFixed(2)}</Text>
          )}
          <Text style={styles.balanceChange}>+$25.42 (3.8%) hoje</Text>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleSendPress}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>↑</Text>
            </View>
            <Text style={styles.actionText}>Enviar</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleReceivePress}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>↓</Text>
            </View>
            <Text style={styles.actionText}>Receber</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('Troca', 'Funcionalidade de troca em desenvolvimento')}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>↔️</Text>
            </View>
            <Text style={styles.actionText}>Trocar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Suas Carteiras</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={wallets}
          renderItem={renderWalletItem}
          keyExtractor={item => item.id}
          style={styles.walletsList}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transações Recentes</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={transactions}
          renderItem={renderTransactionItem}
          keyExtractor={item => item.id}
          style={styles.transactionsList}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          ListEmptyComponent={renderEmptyList}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  settingsIcon: {
    fontSize: 24,
  },
  balanceContainer: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  balanceChange: {
    fontSize: 14,
    color: '#AEDCFF',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIconText: {
    fontSize: 24,
    color: '#007AFF',
  },
  actionText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
  },
  walletsList: {
    marginBottom: 24,
  },
  walletCard: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  walletIconContainer: {
    marginRight: 16,
  },
  walletIcon: {
    width: 40,
    height: 40,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  walletBalance: {
    fontSize: 14,
    color: '#666666',
  },
  walletValue: {
    alignItems: 'flex-end',
  },
  walletValueText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  walletChangeText: {
    fontSize: 12,
    color: '#4CD964',
  },
  transactionsList: {
    flex: 1,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  transactionIconContainer: {
    marginRight: 16,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiveIcon: {
    backgroundColor: 'rgba(76, 217, 100, 0.15)',
  },
  sendIcon: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  transactionIconText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: '#666666',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  transactionValueText: {
    fontSize: 12,
    color: '#666666',
  },
  receiveText: {
    color: '#4CD964',
  },
  sendText: {
    color: '#FF3B30',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  }
});

export default DashboardScreen; 