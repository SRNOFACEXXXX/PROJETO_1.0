import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../styles/colors';
import { borderRadius, shadows, spacing, typography } from '../../styles/styles';

interface CryptoCardProps {
  symbol: string;
  name: string;
  amount: number;
  value: number;
  percentChange: number;
  onPress: () => void;
}

export const CryptoCard: React.FC<CryptoCardProps> = ({
  symbol,
  name,
  amount,
  value,
  percentChange,
  onPress,
}) => {
  const formattedValue = value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const getSymbolColor = () => {
    switch (symbol.toLowerCase()) {
      case 'btc':
        return colors.bitcoin;
      case 'eth':
        return colors.ethereum;
      case 'usdt':
        return colors.tether;
      default:
        return colors.primary;
    }
  };

  const getSymbolLetter = () => {
    switch (symbol.toLowerCase()) {
      case 'btc':
        return 'B';
      case 'eth':
        return 'E';
      case 'usdt':
        return 'U';
      default:
        return symbol.charAt(0).toUpperCase();
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <View style={[styles.symbolContainer, { backgroundColor: getSymbolColor() }]}>
          <Text style={styles.symbolText}>{getSymbolLetter()}</Text>
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.amountText}>{amount.toFixed(4)} {symbol}</Text>
        </View>
        
        <View style={styles.valueContainer}>
          <Text style={styles.valueText}>{formattedValue}</Text>
          {percentChange !== 0 && (
            <Text 
              style={[
                styles.percentText, 
                percentChange > 0 ? styles.positivePercent : styles.negativePercent
              ]}
            >
              {percentChange > 0 ? '↑' : '↓'} {Math.abs(percentChange).toFixed(2)}%
            </Text>
          )}
          {percentChange === 0 && (
            <Text style={styles.neutralPercent}>0%</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.circle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  symbolText: {
    color: colors.textLight,
    fontSize: typography.fontSizes.lg,
    fontWeight: 700,
  },
  infoContainer: {
    flex: 1,
  },
  nameText: {
    color: colors.textLight,
    fontSize: typography.fontSizes.md,
    fontWeight: 500,
    marginBottom: spacing.xs / 2,
  },
  amountText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: typography.fontSizes.sm,
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  valueText: {
    color: colors.textLight,
    fontSize: typography.fontSizes.md,
    fontWeight: 600,
    marginBottom: spacing.xs / 2,
  },
  percentText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: 500,
  },
  positivePercent: {
    color: colors.success,
  },
  negativePercent: {
    color: colors.error,
  },
  neutralPercent: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: typography.fontSizes.sm,
  },
}); 