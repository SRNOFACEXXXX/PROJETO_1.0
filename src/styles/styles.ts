import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const typography = {
  fontWeights: {
    regular: 400,
    medium: 500,
    semiBold: 600,
    bold: 700,
  },
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    jumbo: 40,
  },
  lineHeights: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 36,
    xxxl: 40,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  circle: 999,
};

export const shadows = {
  small: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    ...shadows.medium,
  },
  button: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    ...shadows.small,
  },
  buttonText: {
    color: colors.text,
    fontSize: typography.fontSizes.md,
    fontWeight: 600,
  },
  inputContainer: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputText: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: 700,
    color: colors.textLight,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 500,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  bodyText: {
    fontSize: typography.fontSizes.md,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: colors.textLight,
    fontSize: typography.fontSizes.xs,
    fontWeight: 500,
  },
}); 