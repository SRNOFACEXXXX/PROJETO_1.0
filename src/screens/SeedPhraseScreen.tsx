import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Platform,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { walletService } from '../services/walletService';
import * as Clipboard from 'expo-clipboard';

type SeedPhraseScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SeedPhrase'>;
  route: RouteProp<RootStackParamList, 'SeedPhrase'>;
};

interface WordProps {
  index: number;
  word: string;
}

const WordBox: React.FC<WordProps> = ({ index, word }) => (
  <View style={styles.wordBox}>
    <Text style={styles.wordIndex}>{index}</Text>
    <Text style={styles.wordText}>{word}</Text>
  </View>
);

const SeedPhraseScreen: React.FC<SeedPhraseScreenProps> = ({ navigation, route }) => {
  const { seedPhrase, isNewWallet } = route.params;
  const [confirmedBackup, setConfirmedBackup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seedWords, setSeedWords] = useState<string[]>([]);
  
  useEffect(() => {
    if (seedPhrase) {
      setSeedWords(seedPhrase.split(' '));
    }
  }, [seedPhrase]);

  const handleCopySeedPhrase = async () => {
    try {
      await Clipboard.setStringAsync(seedPhrase);
      Alert.alert(
        'Copiado com Sucesso', 
        'A frase de recuperação foi copiada para a área de transferência. Lembre-se de armazená-la em um local seguro e depois limpar a área de transferência.'
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível copiar a frase de recuperação.');
    }
  };

  const handleShareSeedPhrase = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Indisponível', 'Compartilhamento não está disponível nesta plataforma.');
      return;
    }

    try {
      const result = await Share.share({
        message: 'Minha frase de recuperação da carteira HotWallet:\n\n' + seedPhrase + '\n\nGuarde esta frase em um local seguro e NUNCA a compartilhe com ninguém.',
        title: 'Frase de Recuperação HotWallet'
      });
      
      if (result.action === Share.sharedAction) {
        Alert.alert('Atenção', 'Lembre-se de proteger sua frase de recuperação e excluir qualquer compartilhamento depois de guardá-la em um local seguro.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar a frase de recuperação.');
    }
  };

  const handleConfirmBackup = () => {
    setConfirmedBackup(true);
  };

  const handleContinue = async () => {
    if (!confirmedBackup) {
      Alert.alert(
        'Confirmação Necessária',
        'Você deve confirmar que fez o backup da sua frase de recuperação antes de continuar.',
        [
          { text: 'OK', onPress: () => {} }
        ]
      );
      return;
    }

    try {
      setLoading(true);

      if (isNewWallet) {
        // Se estamos criando uma nova carteira, inicialize-a com a frase seed
        const success = walletService.restoreFromSeedPhrase(seedPhrase);
        
        if (!success) {
          throw new Error('Falha ao criar carteira');
        }
      }

      // Pequeno atraso para feedback visual
      setTimeout(() => {
        setLoading(false);
        
        // Navegar para o Dashboard
        navigation.reset({
          index: 0,
          routes: [{ name: 'Dashboard' }],
        });
      }, 1500);
    } catch (error) {
      console.error('Erro ao finalizar setup da carteira:', error);
      setLoading(false);
      Alert.alert(
        'Erro',
        'Ocorreu um erro ao configurar sua carteira. Por favor, tente novamente.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          {!isNewWallet && (
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={styles.backButtonIcon}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Frase de Recuperação</Text>
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.subtitle}>
            {isNewWallet 
              ? 'Estas 12 palavras são a chave para sua carteira. Faça um backup seguro agora!' 
              : 'Revise sua frase de recuperação para confirmar o backup'}
          </Text>
          
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>ATENÇÃO!</Text>
            <Text style={styles.warningText}>
              • Nunca compartilhe sua frase de recuperação com ninguém
            </Text>
            <Text style={styles.warningText}>
              • Guarde em um local físico seguro (papel)
            </Text>
            <Text style={styles.warningText}>
              • Quem possui esta frase tem acesso total à sua carteira
            </Text>
            <Text style={styles.warningText}>
              • Não tire screenshots ou armazene digitalmente
            </Text>
          </View>

          <View style={styles.seedPhraseContainer}>
            <View style={styles.wordsGrid}>
              {seedWords.map((word, index) => (
                <WordBox 
                  key={index} 
                  index={index + 1} 
                  word={word} 
                />
              ))}
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleCopySeedPhrase}
            >
              <Text style={styles.actionButtonText}>Copiar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleShareSeedPhrase}
            >
              <Text style={styles.actionButtonText}>Compartilhar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.checkboxContainer}>
            <TouchableOpacity 
              style={[
                styles.checkbox, 
                confirmedBackup ? styles.checkboxChecked : {}
              ]}
              onPress={() => setConfirmedBackup(!confirmedBackup)}
            >
              {confirmedBackup && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>
              Confirmo que salvei minha frase de recuperação em um local seguro
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Configurando sua carteira...</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.continueButton,
                  !confirmedBackup ? styles.continueButtonDisabled : {}
                ]} 
                onPress={handleContinue}
                disabled={!confirmedBackup}
              >
                <Text style={styles.continueButtonText}>
                  {isNewWallet ? 'Concluir Configuração' : 'Continuar'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    marginBottom: 16,
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
    paddingHorizontal: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
    marginBottom: 20,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#FFEFEF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
  },
  seedPhraseContainer: {
    backgroundColor: '#f5f7ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wordBox: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  wordIndex: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 6,
    width: 20,
  },
  wordText: {
    fontSize: 14,
    color: '#333333',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#f5f7ff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    width: '48%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  buttonContainer: {
    marginTop: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333333',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SeedPhraseScreen; 