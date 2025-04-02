import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  TouchableOpacityProps,
  View,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { colors } from '../../styles/colors';
import { borderRadius, spacing, typography } from '../../styles/styles';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  ...rest
}) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryButton;
      case 'outline':
        return styles.outlineButton;
      case 'text':
        return styles.textButton;
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryButtonText;
      case 'outline':
        return styles.outlineButtonText;
      case 'text':
        return styles.textButtonText;
      default:
        return styles.primaryButtonText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallButton;
      case 'large':
        return styles.largeButton;
      default:
        return styles.mediumButton;
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallButtonText;
      case 'large':
        return styles.largeButtonText;
      default:
        return styles.mediumButtonText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        getSizeStyle(),
        fullWidth && styles.fullWidth,
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'text' ? colors.primary : colors.textLight}
        />
      ) : (
        <View style={styles.contentContainer}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text
            style={[
              styles.buttonText,
              getTextStyle(),
              getTextSizeStyle(),
              disabled && styles.disabledButtonText,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.secondary,
  },
  secondaryButton: {
    backgroundColor: colors.primary,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  textButton: {
    backgroundColor: 'transparent',
  },
  smallButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 32,
  },
  mediumButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  largeButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  fullWidth: {
    width: '100%',
  },
  disabledButton: {
    opacity: 0.5,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: 600,
    textAlign: 'center',
  },
  primaryButtonText: {
    color: colors.text,
  },
  secondaryButtonText: {
    color: colors.textLight,
  },
  outlineButtonText: {
    color: colors.secondary,
  },
  textButtonText: {
    color: colors.primary,
  },
  smallButtonText: {
    fontSize: typography.fontSizes.sm,
  },
  mediumButtonText: {
    fontSize: typography.fontSizes.md,
  },
  largeButtonText: {
    fontSize: typography.fontSizes.lg,
  },
  disabledButtonText: {
    color: colors.textDisabled,
  },
  iconLeft: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginLeft: spacing.xs,
  },
}); 