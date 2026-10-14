import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Sistema visual do BR Bit, fiel ao canvas de design: preto puro, verde neon com brilho,
 * superfícies quase pretas, bordas de 8-18% de branco.
 */
export const colors = {
  bg: '#000000',
  surface: '#0C0D0E',
  surface2: '#131416',
  surface3: '#1B1D20',
  border: 'rgba(255,255,255,0.08)',
  borderMid: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.18)',
  text: '#F2F4F3',
  soft: '#C9CDD0',
  muted: '#8B9096',
  dim: '#6B7076',
  green: '#2BFF88',
  greenInk: '#00140A',
  greenMint: '#BFFFD9',
  greenLine: 'rgba(43,255,136,0.4)',
  greenFaint: 'rgba(43,255,136,0.10)',
  red: '#FF5470',
  redSoft: '#FF6B86',
  redFaint: 'rgba(255,84,112,0.10)',
  amber: '#FFC53D',
  amberSoft: '#E9D9A6',
  amberLine: 'rgba(255,197,61,0.35)',
  btc: '#F7931A',
  btcInk: '#1A0F00',
  sol: '#9945FF',
  cyan: '#4DD8FF',
} as const;

/** Convenção de corretoras: verde sobe, vermelho desce. Sempre acompanhados de ▲/▼. */
export const trend = { up: colors.green, down: colors.red } as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Nomes das fontes carregadas em App.tsx (pacotes @expo-google-fonts, embutidos no app). */
export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayMed: 'SpaceGrotesk_500Medium',
  displayBold: 'SpaceGrotesk_700Bold',
  body: 'Manrope_500Medium',
  bodyReg: 'Manrope_400Regular',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyHeavy: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMed: 'JetBrainsMono_500Medium',
} as const;

/** Brilho neon: sombra colorida (iOS e Android 9+) + elevação. */
export function glow(color: string = colors.green, strength = 1): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: 0.55 * strength,
    shadowRadius: 18 * strength,
    shadowOffset: { width: 0, height: 0 },
    elevation: Math.round(10 * strength),
  };
}

export const type = {
  h1: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: -0.4, color: colors.text } as TextStyle,
  h2: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.3, color: colors.text } as TextStyle,
  h3: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.text } as TextStyle,
  section: { fontFamily: fonts.display, fontSize: 18, color: colors.text } as TextStyle,
  body: { fontFamily: fonts.bodyReg, fontSize: 16, lineHeight: 24, color: colors.muted } as TextStyle,
  bodySm: { fontFamily: fonts.bodyReg, fontSize: 14, lineHeight: 21, color: colors.muted } as TextStyle,
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.2, color: colors.muted } as TextStyle,
  caption: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted } as TextStyle,
  mono: { fontFamily: fonts.mono, fontSize: 14, color: colors.text } as TextStyle,
  monoSm: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted } as TextStyle,
} as const;
