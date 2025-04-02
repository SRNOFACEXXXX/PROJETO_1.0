import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Switch,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  
  const handleBackupWallet = () => {
    // Navegar para a tela de frase semente em modo somente leitura
    navigation.navigate('SeedPhrase', {
      seedPhrase: 'mango apple banana orange grape lemon peach cherry kiwi melon pear strawberry blueberry',
      isNewWallet: false
    });
  };

  const handleResetPin = () => {
    Alert.alert(
      'Redefinir PIN',
      'Tem certeza de que deseja redefinir seu PIN? Você será redirecionado para a tela de configuração de PIN.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Redefinir', 
          style: 'destructive',
          onPress: () => {
            // Navegar para a tela de autenticação em modo redefinição
            navigation.navigate('Auth');
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza de que deseja sair? Você precisará autenticar-se novamente para acessar suas carteiras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: () => {
            // Navegar para a tela de onboarding
            navigation.reset({
              index: 0,
              routes: [{ name: 'Onboarding' }],
            });
          }
        }
      ]
    );
  };

  const handleDeleteWallet = () => {
    Alert.alert(
      'Excluir Carteira',
      'ATENÇÃO: Esta ação é irreversível! Certifique-se de ter feito backup da sua frase de recuperação antes de continuar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir Carteira', 
          style: 'destructive',
          onPress: () => {
            // Confirmação adicional para exclusão
            Alert.alert(
              'Confirmar Exclusão',
              'Tem certeza absoluta? Todas as suas carteiras e dados serão excluídos permanentemente.',
              [
                { text: 'Não, Manter Carteira', style: 'cancel' },
                {
                  text: 'Sim, Excluir Permanentemente',
                  style: 'destructive',
                  onPress: () => {
                    // Retornar para a tela de onboarding
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Onboarding' }],
                    });
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Configurações</Text>
        <View style={styles.placeholderRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Segurança</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleBackupWallet}
          >
            <Text style={styles.settingText}>Fazer Backup da Carteira</Text>
            <Text style={styles.settingIcon}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleResetPin}
          >
            <Text style={styles.settingText}>Alterar PIN</Text>
            <Text style={styles.settingIcon}>→</Text>
          </TouchableOpacity>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Autenticação Biométrica</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferências</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Notificações</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              thumbColor={'#FFFFFF'}
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingText}>Modo Escuro</Text>
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              thumbColor={'#FFFFFF'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Versão do Aplicativo</Text>
            <Text style={styles.versionText}>1.0.0</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Termos de Uso</Text>
            <Text style={styles.settingIcon}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Política de Privacidade</Text>
            <Text style={styles.settingIcon}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Sair da Conta</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDeleteWallet}
          >
            <Text style={styles.deleteButtonText}>Excluir Carteira</Text>
          </TouchableOpacity>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  placeholderRight: {
    width: 24,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingText: {
    fontSize: 16,
    color: '#333333',
  },
  settingIcon: {
    fontSize: 18,
    color: '#999999',
  },
  versionText: {
    fontSize: 16,
    color: '#999999',
  },
  buttonContainer: {
    marginTop: 20,
  },
  logoutButton: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  logoutButtonText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: '500',
  },
});

export default SettingsScreen; 