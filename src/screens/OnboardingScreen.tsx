import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Dimensions, 
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { BRBITLogo } from '../components/BRBITLogo';
import { Button } from '../components/ui/Button';
import { colors } from '../styles/colors';
import { borderRadius, spacing, typography } from '../styles/styles';

type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

const windowWidth = Dimensions.get('window').width;

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const handleCreateWallet = () => {
    navigation.navigate('CreateWallet');
  };

  const handleRestoreWallet = () => {
    navigation.navigate('RestoreWallet');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      <View style={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <BRBITLogo size="large" />
        </View>
        
        <View style={styles.buttonContainer}>
          <Button 
            title="CRIAR CARTEIRA" 
            onPress={handleCreateWallet} 
            variant="primary"
            size="large"
            fullWidth
            style={styles.createButton}
          />
          
          <View style={styles.importContainer}>
            <Text style={styles.alreadyHaveText}>Já tem uma carteira?</Text>
            <TouchableOpacity onPress={handleRestoreWallet}>
              <Text style={styles.importText}>Importar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  createButton: {
    height: 56,
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
  },
  importContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  alreadyHaveText: {
    color: colors.textLight,
    fontSize: typography.fontSizes.md,
    marginRight: spacing.xs,
  },
  importText: {
    color: colors.secondary,
    fontSize: typography.fontSizes.md,
    fontWeight: 600,
  },
});

export default OnboardingScreen; 