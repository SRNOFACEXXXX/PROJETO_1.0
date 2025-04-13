import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Alert,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type AuthScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'>;
};

const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
  const [pin, setPin] = useState<string>('');
  const [isPinSetup, setIsPinSetup] = useState<boolean>(false);
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [isBiometricSupported, setIsBiometricSupported] = useState<boolean>(false);
  
  // Simular verificação de biometria disponível
  useEffect(() => {
    const checkBiometricSupport = async () => {
      // Aqui seria implementada a verificação real com expo-local-authentication
      setIsBiometricSupported(Platform.OS !== 'web');
    };
    
    checkBiometricSupport();
  }, []);

  const handlePinDigit = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      
      if (newPin.length === 6) {
        if (!isPinSetup) {
          // Primeiro PIN digitado, solicitar confirmação
          setIsPinSetup(true);
          setConfirmPin('');
          setTimeout(() => setPin(''), 200);
        } else {
          // Confirmação do PIN
          if (newPin === confirmPin) {
            // PIN configurado com sucesso
            handleAuthSuccess();
          } else {
            // PINs não coincidem
            Alert.alert('Erro', 'Os PINs não coincidem. Tente novamente.');
            setIsPinSetup(false);
            setTimeout(() => setPin(''), 200);
          }
        }
      }
    }
  };

  const handleDeleteDigit = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const handleBiometricAuth = async () => {
    // Aqui seria implementada a autenticação biométrica real
    // Simulação: autenticação bem-sucedida
    Alert.alert('Simulação', 'Autenticação biométrica bem-sucedida');
    handleAuthSuccess();
  };

  const handleAuthSuccess = () => {
    // Navegar para o Dashboard
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>
          {!isPinSetup 
            ? 'Configure seu PIN' 
            : 'Confirme seu PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {!isPinSetup 
            ? 'Crie um PIN de 6 dígitos para proteger sua carteira' 
            : 'Digite novamente o PIN para confirmar'}
        </Text>
      </View>

      <View style={styles.pinContainer}>
        {[...Array(6)].map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.pinDot, 
              index < pin.length ? styles.pinDotFilled : {}
            ]}
          />
        ))}
      </View>

      <View style={styles.keypadContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <TouchableOpacity
            key={digit}
            style={styles.keypadButton}
            onPress={() => handlePinDigit(digit.toString())}
          >
            <Text style={styles.keypadButtonText}>{digit}</Text>
          </TouchableOpacity>
        ))}
        
        <View style={styles.keypadButton}>
          {isBiometricSupported && !isPinSetup && (
            <TouchableOpacity onPress={handleBiometricAuth}>
              <Text style={styles.biometricText}>🔐</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.keypadButton}
          onPress={() => handlePinDigit('0')}
        >
          <Text style={styles.keypadButtonText}>0</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.keypadButton}
          onPress={handleDeleteDigit}
        >
          <Text style={styles.deleteButtonText}>⌫</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    maxWidth: '80%',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 60,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 10,
  },
  pinDotFilled: {
    backgroundColor: '#007AFF',
  },
  keypadContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
  },
  keypadButton: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  keypadButtonText: {
    fontSize: 32,
    color: '#333333',
  },
  deleteButtonText: {
    fontSize: 28,
    color: '#666666',
  },
  biometricText: {
    fontSize: 26,
  },
});

export default AuthScreen; 