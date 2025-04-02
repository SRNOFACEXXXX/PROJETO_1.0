import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { walletService } from '../services/walletService';

type CreateWalletScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreateWallet'>;
};

const CreateWalletScreen: React.FC<CreateWalletScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);

  const handleCreateWallet = async () => {
    try {
      setLoading(true);
      
      // Gerar nova frase de recuperação usando o walletService
      const seedPhrase = walletService.generateSeedPhrase();
      
      // Aguardar um pouco para dar a impressão de processamento
      // (em um app real, esse tempo seria o próprio processamento)
      setTimeout(() => {
        setLoading(false);
        // Navegar para a tela de frase semente
        navigation.navigate('SeedPhrase', {
          seedPhrase: seedPhrase,
          isNewWallet: true
        });
      }, 1500);
    } catch (error) {
      setLoading(false);
      Alert.alert('Erro', 'Não foi possível criar a carteira. Tente novamente.');
      console.error('Erro ao criar carteira:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Criar Nova Carteira</Text>
        </View>

        <View style={styles.imageContainer}>
          <View style={[styles.image, {backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center'}]}>
            <Text style={{fontSize: 16, color: '#007AFF'}}>Ícone de Carteira</Text>
          </View>
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.subtitle}>
            Crie uma nova carteira multi-blockchain segura em segundos
          </Text>

          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Importante:</Text>
            <View style={styles.infoItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.infoText}>
                Você receberá uma frase de recuperação com 12 palavras
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.infoText}>
                Anote esta frase em um local seguro e offline
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.infoText}>
                Nunca compartilhe sua frase de recuperação com ninguém
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.infoText}>
                Se você perder sua frase, perderá acesso permanente aos seus fundos
              </Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Gerando sua carteira segura...</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.createButton} 
                onPress={handleCreateWallet}
              >
                <Text style={styles.createButtonText}>Criar Carteira</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.restoreButton} 
              onPress={() => navigation.navigate('RestoreWallet')}
              disabled={loading}
            >
              <Text style={styles.restoreButtonText}>
                Já tenho uma frase de recuperação
              </Text>
            </TouchableOpacity>
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
  imageContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  image: {
    width: 200,
    height: 200,
  },
  contentContainer: {
    paddingHorizontal: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
    marginBottom: 24,
    textAlign: 'center',
  },
  infoContainer: {
    backgroundColor: '#f5f7ff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bullet: {
    marginRight: 8,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 16,
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
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  restoreButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateWalletScreen; 