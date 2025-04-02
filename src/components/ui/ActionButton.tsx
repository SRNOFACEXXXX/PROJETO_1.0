import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ViewStyle,
  TextStyle,
  StyleProp
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/colors';
import { borderRadius, spacing, typography } from '../../styles/styles';

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  backgroundColor?: string;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onPress,
  backgroundColor = colors.primary,
  iconColor = colors.textLight,
  style,
  labelStyle,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor }, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={24} color={iconColor} />
      <Text style={[styles.label, labelStyle]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  label: {
    color: colors.textLight,
    fontSize: typography.fontSizes.xs,
    marginTop: spacing.xs,
  },
}); 