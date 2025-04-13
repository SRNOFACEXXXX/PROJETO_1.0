import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Share,
  KeyboardAvoidingView, 
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { walletService, Wallet } from '../services/walletService';

type TransactionScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Transaction'>;
  route: RouteProp<RootStackParamList, 'Transaction'>;
};

const TransactionScreen: React.FC<TransactionScreenProps> = ({ navigation, route }) => {
  const { mode, walletId } = route.params;
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState(walletId || '');

  useEffect(() => {
    // Carregar carteiras e, se houver um walletId, definir como ativo
    const loadedWallets = walletService.getWallets();
    setWallets(loadedWallets);

    if (selectedWalletId) {
      const wallet = walletService.getWalletById(selectedWalletId);
      if (wallet) {
        setActiveWallet(wallet);
      } else if (loadedWallets.length > 0) {
        setActiveWallet(loadedWallets[0]);
        setSelectedWalletId(loadedWallets[0].id);
      }
    } else if (loadedWallets.length > 0) {
      setActiveWallet(loadedWallets[0]);
      setSelectedWalletId(loadedWallets[0].id);
    }
  }, [walletId, selectedWalletId]);

  const handleSend = async () => {
    try {
      // Validações básicas
      if (!activeWallet) {
        setError('Selecione uma carteira para enviar');
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setError('Insira um valor válido para enviar');
        return;
      }

      if (!address.trim()) {
        setError('Insira um endereço de destino válido');
        return;
      }

      setLoading(true);
      setError('');

      // Enviar a transação através do serviço
      const result = await walletService.sendTransaction(
        activeWallet.symbol,
        address.trim(),
        parseFloat(amount)
      );

      if (result.success) {
        setLoading(false);
        Alert.alert(
          'Transação Enviada',
          `Sua transação de ${amount} ${activeWallet.symbol} foi enviada com sucesso!\n\nHash: ${result.txHash}`,
          [
            { 
              text: 'OK', 
              onPress: () => navigation.navigate('Dashboard') 
            }
          ]
        );
      } else {
        throw new Error(result.error || 'Erro ao enviar transação');
      }
    } catch (error) {
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Erro desconhecido ao enviar transação');
      console.error('Erro ao enviar transação:', error);
    }
  };

  const handleCopyAddress = async () => {
    if (!activeWallet) return;
    
    try {
      await Clipboard.setStringAsync(activeWallet.address);
      Alert.alert('Copiado!', 'Endereço copiado para a área de transferência');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível copiar o endereço');
    }
  };

  const handleShareAddress = async () => {
    if (!activeWallet) return;
    
    try {
      await Share.share({
        message: `Meu endereço ${activeWallet.name} (${activeWallet.symbol}): ${activeWallet.address}`,
        title: `Endereço ${activeWallet.symbol}`
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar o endereço');
    }
  };

  const handleSelectWallet = (wallet: Wallet) => {
    setActiveWallet(wallet);
    setSelectedWalletId(wallet.id);
    // Limpar campos ao trocar de carteira
    if (mode === 'send') {
      setAmount('');
      setError('');
    }
  };

  // Função para simular recebimento (apenas para demonstração)
  const handleSimulateReceive = () => {
    if (!activeWallet) return;
    
    const receiveAmount = parseFloat(amount);
    if (!receiveAmount || receiveAmount <= 0) {
      setError('Insira um valor válido para simular recebimento');
      return;
    }

    setLoading(true);
    
    // Simular um pequeno atraso
    setTimeout(() => {
      const success = walletService.simulateReceiveFunds(
        activeWallet.symbol, 
        receiveAmount
      );
      
      setLoading(false);
      
      if (success) {
        Alert.alert(
          'Fundos Recebidos!', 
          `Você recebeu ${receiveAmount} ${activeWallet.symbol} em sua carteira.`,
          [
            { 
              text: 'OK', 
              onPress: () => navigation.navigate('Dashboard') 
            }
          ]
        );
      } else {
        setError('Falha ao simular recebimento de fundos');
      }
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {mode === 'send' ? 'Enviar' : 'Receber'}
            </Text>
          </View>

          <View style={styles.contentContainer}>
            {/* Seleção de carteira */}
            <Text style={styles.sectionTitle}>Selecione a Carteira</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.walletsScroll}
              contentContainerStyle={styles.walletsContainer}
            >
              {wallets.map((wallet) => (
                <TouchableOpacity
                  key={wallet.id}
                  style={[
                    styles.walletItem,
                    wallet.id === selectedWalletId ? styles.walletItemSelected : {}
                  ]}
                  onPress={() => handleSelectWallet(wallet)}
                >
                  <Image 
                    source={{ uri: wallet.icon }} 
                    style={styles.walletIcon}
                  />
                  <View style={styles.walletInfo}>
                    <Text style={styles.walletSymbol}>{wallet.symbol}</Text>
                    <Text style={styles.walletBalance}>
                      {wallet.balance.toFixed(6)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Seção de Envio */}
            {mode === 'send' && (
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Valor a Enviar</Text>
                  <TextInput
                    style={[styles.input, error && error.includes('valor') ? styles.inputError : {}]}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder={`0.00 ${activeWallet?.symbol || ''}`}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                  {activeWallet && (
                    <Text style={styles.balanceText}>
                      Saldo disponível: {activeWallet.balance.toFixed(6)} {activeWallet.symbol}
                    </Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Endereço de Destino</Text>
                  <TextInput
                    style={[styles.input, error && error.includes('endereço') ? styles.inputError : {}]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Cole o endereço aqui"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={handleSend}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionButtonText}>Enviar</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Seção de Recebimento */}
            {mode === 'receive' && (
              <View style={styles.receiveContainer}>
                {activeWallet ? (
                  <>
                    <View style={styles.qrContainer}>
                      <QRCode
                        value={activeWallet.address}
                        size={180}
                        backgroundColor="white"
                        color="black"
                      />
                    </View>
                    
                    <Text style={styles.addressLabel}>Seu endereço {activeWallet.symbol}</Text>
                    <Text style={styles.addressText}>{activeWallet.address}</Text>
                    
                    <View style={styles.addressActionsContainer}>
                      <TouchableOpacity 
                        style={styles.addressActionButton}
                        onPress={handleCopyAddress}
                      >
                        <Text style={styles.addressActionText}>Copiar</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.addressActionButton}
                        onPress={handleShareAddress}
                      >
                        <Text style={styles.addressActionText}>Compartilhar</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Este é um recurso apenas para demonstração - simular recebimento */}
                    <View style={styles.simulateContainer}>
                      <Text style={styles.simulateTitle}>Demonstração: Simular Recebimento</Text>
                      <View style={styles.inputGroup}>
                        <TextInput
                          style={styles.input}
                          value={amount}
                          onChangeText={setAmount}
                          placeholder={`Valor em ${activeWallet.symbol}`}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      
                      {error ? <Text style={styles.errorText}>{error}</Text> : null}
                      
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.simulateButton]}
                        onPress={handleSimulateReceive}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.actionButtonText}>Simular Recebimento</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <ActivityIndicator size="large" color="#007AFF" />
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  backButtonIcon: {
    fontSize: 24,
    color: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  walletsScroll: {
    marginBottom: 24,
  },
  walletsContainer: {
    paddingRight: 16,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7ff',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    width: 140,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  walletItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  walletIcon: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  walletInfo: {
    flex: 1,
  },
  walletSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  walletBalance: {
    fontSize: 12,
    color: '#666666',
  },
  formContainer: {
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f7ff',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  balanceText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  receiveContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  addressActionsContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  addressActionButton: {
    backgroundColor: '#f5f7ff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
    marginHorizontal: 8,
  },
  addressActionText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  simulateContainer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 24,
    marginTop: 16,
  },
  simulateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  simulateButton: {
    backgroundColor: '#34C759',
  }
});

export default TransactionScreen; 