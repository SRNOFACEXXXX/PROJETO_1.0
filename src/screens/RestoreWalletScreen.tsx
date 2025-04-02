import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput,
  ScrollView, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { walletService } from '../services/walletService';

type RestoreWalletScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RestoreWallet'>;
};

const RestoreWalletScreen: React.FC<RestoreWalletScreenProps> = ({ navigation }) => {
  const [seedPhrase, setSeedPhrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRestoreWallet = async () => {
    try {
      // Verificar se a frase de recuperação foi fornecida
      if (!seedPhrase.trim()) {
        setError('Por favor, insira sua frase de recuperação');
        return;
      }

      setIsLoading(true);
      setError('');

      // Verificar se a frase tem 12 palavras
      const words = seedPhrase.trim().split(/\s+/);
      if (words.length !== 12) {
        setError('A frase de recuperação deve conter exatamente 12 palavras');
        setIsLoading(false);
        return;
      }

      // Tentar restaurar a carteira
      const success = walletService.restoreFromSeedPhrase(seedPhrase.trim());

      if (success) {
        // Simular um pequeno atraso para dar feedback ao usuário
        setTimeout(() => {
          setIsLoading(false);
          
          // Navegar para o Dashboard após restauração bem-sucedida
          navigation.reset({
            index: 0,
            routes: [{ name: 'Dashboard' }],
          });
        }, 2000);
      } else {
        setError('Não foi possível restaurar a carteira. Verifique sua frase de recuperação.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Erro ao restaurar carteira:', error);
      setError('Ocorreu um erro ao restaurar sua carteira. Tente novamente.');
      setIsLoading(false);
    }
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
              disabled={isLoading}
            >
              <Text style={styles.backButtonIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Restaurar Carteira</Text>
          </View>

          <View style={styles.contentContainer}>
            <Text style={styles.subtitle}>
              Insira sua frase de recuperação de 12 palavras para restaurar sua carteira
            </Text>

            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Frase de Recuperação</Text>
              <TextInput
                style={[styles.input, error ? styles.inputError : null]}
                placeholder="Insira as 12 palavras separadas por espaço"
                value={seedPhrase}
                onChangeText={setSeedPhrase}
                multiline
                numberOfLines={4}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              
              <Text style={styles.infoText}>
                Importante: Digite as palavras na ordem correta e verifique a ortografia.
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>Restaurando sua carteira...</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.restoreButton} 
                  onPress={handleRestoreWallet}
                >
                  <Text style={styles.restoreButtonText}>Restaurar Carteira</Text>
                </TouchableOpacity>
              )}
            </View>
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
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
    marginBottom: 24,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 30,
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
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 16,
  },
  buttonContainer: {
    marginTop: 24,
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
  restoreButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});

export default RestoreWalletScreen; 