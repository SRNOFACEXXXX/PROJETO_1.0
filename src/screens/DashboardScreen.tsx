import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  RefreshControl, 
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { CryptoCard } from '../components/cards/CryptoCard';
import { ActionButton } from '../components/ui/ActionButton';
import { walletService } from '../services/walletService';
import { Ionicons } from '@expo/vector-icons';
import { BRBITLogo } from '../components/BRBITLogo';
import { colors } from '../styles/colors';
import { borderRadius, spacing, typography } from '../styles/styles';

type DashboardScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

type TabType = 'Crypto' | 'NFTs';

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const [wallets, setWallets] = useState<any[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('Crypto');

  const fetchWalletData = useCallback(async () => {
    try {
      setLoading(true);
      // Buscar dados da carteira usando o serviço
      const walletsData = walletService.getWallets();
      
      // Calcular saldo total
      const total = walletsData.reduce((sum, wallet) => sum + wallet.balance, 0);
      
      setWallets(walletsData);
      setTotalBalance(total);
    } catch (error) {
      console.error('Erro ao buscar dados da carteira:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchWalletData();
    }, [fetchWalletData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  }, [fetchWalletData]);

  const handleWalletPress = (wallet: any) => {
    // Navegar para detalhes da carteira quando o usuário clicar em um cartão
    navigation.navigate('Transaction', { mode: 'send', walletId: wallet.symbol });
  };

  const handleSendPress = () => {
    navigation.navigate('Transaction', { mode: 'send' });
  };

  const handleReceivePress = () => {
    navigation.navigate('Transaction', { mode: 'receive' });
  };

  const handleExchangePress = () => {
    // Implementar funcionalidade de troca
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      <View style={styles.header}>
        <BRBITLogo size="small" />
        <TouchableOpacity onPress={handleSettingsPress}>
          <Ionicons name="settings-outline" size={24} color={colors.textLight} />
        </TouchableOpacity>
      </View>
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.secondary]}
            tintColor={colors.secondary}
          />
        }
      >
        {/* Total Assets Card */}
        <View style={styles.assetsCard}>
          <Text style={styles.assetsLabel}>Total Assets</Text>
          <Text style={styles.assetsValue}>
            {loading ? <ActivityIndicator size="small" color={colors.textLight} /> : formatCurrency(totalBalance)}
          </Text>
          
          <View style={styles.actionButtonsRow}>
            <ActionButton
              icon="add"
              label="Comprar"
              onPress={() => {}}
              backgroundColor={colors.primary}
            />
            <ActionButton
              icon="arrow-up"
              label="Enviar"
              onPress={handleSendPress}
              backgroundColor={colors.primary}
            />
            <ActionButton
              icon="arrow-down"
              label="Receber"
              onPress={handleReceivePress}
              backgroundColor={colors.primary}
            />
            <ActionButton
              icon="analytics"
              label="Exchange"
              onPress={handleExchangePress}
              backgroundColor={colors.primary}
            />
          </View>
        </View>
        
        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'Crypto' && styles.activeTab]} 
            onPress={() => setActiveTab('Crypto')}
          >
            <Text style={[styles.tabText, activeTab === 'Crypto' && styles.activeTabText]}>Crypto</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'NFTs' && styles.activeTab]} 
            onPress={() => setActiveTab('NFTs')}
          >
            <Text style={[styles.tabText, activeTab === 'NFTs' && styles.activeTabText]}>NFTs</Text>
          </TouchableOpacity>
          
          <View style={styles.manageContainer}>
            <Text style={styles.manageText}>Manage</Text>
          </View>
        </View>
        
        {/* Lista de moedas */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.secondary} />
          </View>
        ) : (
          <View style={styles.cryptoList}>
            {wallets.map((wallet) => (
              <CryptoCard 
                key={wallet.symbol}
                symbol={wallet.symbol}
                name={wallet.name}
                amount={wallet.amount}
                value={wallet.balance}
                percentChange={wallet.percentChange || 0}
                onPress={() => handleWalletPress(wallet)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  scrollContent: {
    padding: spacing.md,
  },
  assetsCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  assetsLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textLight,
    opacity: 0.8,
    marginBottom: spacing.xs,
  },
  assetsValue: {
    fontSize: typography.fontSizes.jumbo,
    color: colors.textLight,
    fontWeight: 700,
    marginBottom: spacing.md,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  tabContainer: {
    flexDirection: 'row',
    marginVertical: spacing.md,
    alignItems: 'center',
  },
  tab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    backgroundColor: colors.darkBackground,
  },
  activeTab: {
    backgroundColor: colors.darkBackground,
  },
  tabText: {
    color: colors.textLight,
    opacity: 0.7,
    fontWeight: 500,
  },
  activeTabText: {
    color: colors.textLight,
    opacity: 1,
    fontWeight: 600,
  },
  manageContainer: {
    marginLeft: 'auto',
  },
  manageText: {
    color: colors.secondary,
    fontWeight: 600,
  },
  cryptoList: {
    marginBottom: spacing.md,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
});

export default DashboardScreen; 