import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../styles/colors';

interface BRBITLogoProps {
  size?: 'small' | 'medium' | 'large';
}

export const BRBITLogo: React.FC<BRBITLogoProps> = ({ size = 'medium' }) => {
  const getSizeFactor = () => {
    switch (size) {
      case 'small':
        return 0.7;
      case 'large':
        return 1.5;
      default:
        return 1;
    }
  };

  const sizeFactor = getSizeFactor();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={[styles.brText, { fontSize: 40 * sizeFactor }]}>BR</Text>
      </View>
      <View style={styles.bottomRow}>
        <Text style={[styles.bitText, { fontSize: 40 * sizeFactor }]}>BIT</Text>
        <View style={[styles.yellowBar, { height: 6 * sizeFactor, bottom: 5 * sizeFactor }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  brText: {
    color: colors.textLight,
    fontWeight: '900',
    letterSpacing: -1,
  },
  bitText: {
    color: colors.textLight,
    fontWeight: '900',
    letterSpacing: -1,
    position: 'relative',
  },
  yellowBar: {
    position: 'absolute',
    backgroundColor: colors.secondary,
    width: '100%',
    bottom: 5,
    height: 6,
    zIndex: -1,
  },
}); 