import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importação das telas
import OnboardingScreen from '../screens/OnboardingScreen';
import CreateWalletScreen from '../screens/CreateWalletScreen';
import RestoreWalletScreen from '../screens/RestoreWalletScreen';
import SeedPhraseScreen from '../screens/SeedPhraseScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TransactionScreen from '../screens/TransactionScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Definição dos tipos de parâmetros para as rotas
export type RootStackParamList = {
  Onboarding: undefined;
  CreateWallet: undefined;
  RestoreWallet: undefined;
  SeedPhrase: {
    seedPhrase: string;
    isNewWallet: boolean;
  };
  Dashboard: undefined;
  Transaction: {
    mode: 'send' | 'receive';
    walletId?: string;
  };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Onboarding"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        {/* Fluxo de Onboarding */}
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="CreateWallet" component={CreateWalletScreen} />
        <Stack.Screen name="RestoreWallet" component={RestoreWalletScreen} />
        <Stack.Screen name="SeedPhrase" component={SeedPhraseScreen} />
        
        {/* Fluxo principal do app */}
        <Stack.Screen 
          name="Dashboard" 
          component={DashboardScreen} 
          options={{ gestureEnabled: false }} // Evita voltar com gesto para segurança
        />
        <Stack.Screen name="Transaction" component={TransactionScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 