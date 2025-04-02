import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type OnboardingScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;

const { width, height } = Dimensions.get('window');

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();

  const handleCreateWallet = () => {
    navigation.navigate('CreateWallet');
  };

  const handleRestoreWallet = () => {
    navigation.navigate('RestoreWallet');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.logoContainer}>
        <View 
          style={[styles.logo, {backgroundColor: '#A3D9A5', justifyContent: 'center', alignItems: 'center', borderRadius: 50}]}
        >
          <Text style={{fontSize: 36, color: '#000000'}}>🔐</Text>
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Bem-vindo à HotWallet</Text>
        
        <Text style={styles.subtitle}>
          Carteira segura e descentralizada para suas criptomoedas
        </Text>
        
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>🔒</Text>
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Segurança Máxima</Text>
              <Text style={styles.featureDescription}>
                Sua frase semente nunca é armazenada no dispositivo
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>🔄</Text>
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Multi-blockchain</Text>
              <Text style={styles.featureDescription}>
                Suporte para Ethereum, Bitcoin e Solana
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>👆</Text>
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Autenticação Biométrica</Text>
              <Text style={styles.featureDescription}>
                Use impressão digital ou reconhecimento facial
              </Text>
            </View>
          </View>
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={handleCreateWallet}
        >
          <Text style={styles.primaryButtonText}>Criar Nova Carteira</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={handleRestoreWallet}
        >
          <Text style={styles.secondaryButtonText}>Restaurar Carteira Existente</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.versionText}>Versão 1.0.0</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: height * 0.05,
  },
  logo: {
    width: width * 0.4,
    height: width * 0.4,
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
    marginBottom: 30,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F9E79F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  featureIconText: {
    fontSize: 24,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#555555',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 20,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#A3D9A5',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#A3D9A5',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  versionText: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 10,
  },
});

export default OnboardingScreen; 