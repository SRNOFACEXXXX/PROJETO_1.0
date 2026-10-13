import type { ViewStyle } from 'react-native';

export const colors = {
  bg: '#05060D',
  bg2: '#0B0820',
  surface: '#0D0F1E',
  surface2: '#141731',
  border: '#23284D',
  text: '#EAF0FF',
  muted: '#7F89B5',
  cyan: '#00F0FF',
  magenta: '#FF2BD6',
  lime: '#B6FF3B',
  danger: '#FF4D6D',
  warn: '#FFC23D',
} as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** Brilho neon: sombra colorida (iOS) + elevação (Android). */
export function glow(color: string, strength = 1): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: 0.85 * strength,
    shadowRadius: 14 * strength,
    shadowOffset: { width: 0, height: 0 },
    elevation: Math.round(8 * strength),
  };
}

export const mono = 'monospace';
