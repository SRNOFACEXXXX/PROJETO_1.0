import 'react-native-get-random-values';
import './src/utils/polyfills';
import React from 'react';
import { AppRegistry } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

// Componente principal
const App = () => {
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
};

// Registrar diretamente
AppRegistry.registerComponent('main', () => App); 