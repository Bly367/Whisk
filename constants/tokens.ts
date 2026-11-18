/**
 * Yolk & Chick design tokens — single color source for Whisk UI chrome.
 * Prefer semantic theme colors in components; reach for brand tokens only when needed.
 */

export const brand = {
  yolk: '#F0954A',
  yolkPressed: '#D97E35',
  yolkSoft: '#FCE3CF',
  /** Soft yolk wash for dark mode — keeps accent readable without glare. */
  yolkSoftDark: '#3D2A1A',
  /** Slightly darker orange for dark-mode accent surfaces. */
  yolkMuted: '#C87838',
  chick: '#FFD968',
} as const;

export const lightPalette = {
  surface: {
    canvas: '#F6E9DE',
    card: '#FFFFFF',
    sunken: '#FBF1EA',
  },
  text: {
    primary: '#1E1A17',
    /** Doc #8A817A is 3.2:1 on canvas — darkened to meet WCAG AA body text (4.5:1). */
    secondary: '#726962',
    inverse: '#F6E9DE',
  },
  border: {
    subtle: '#EDE3DA',
  },
  semantic: {
    success: '#35804A',
    warning: '#A85F00',
    error: '#B8423E',
    info: '#3567A8',
  },
} as const;

export const darkPalette = {
  surface: {
    canvas: '#171510',
    card: '#211E18',
    sunken: '#2A261F',
  },
  text: {
    primary: '#F8F4EA',
    secondary: '#B5AA9A',
    inverse: '#1E1A17',
  },
  border: {
    subtle: '#3A342B',
  },
  semantic: {
    success: '#3D9B64',
    warning: '#D4891A',
    error: '#E0554A',
    info: '#5B8FD4',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  control: 12,
  card: 16,
  chip: 20,
  pill: 999,
} as const;

/** Platform minimums: 44 iOS / 48 Android — use the larger by default for shared chrome. */
export const touchTarget = {
  min: 48,
  ios: 44,
  android: 48,
} as const;

export const typography = {
  display: { 
    fontSize: 32, 
    lineHeight: 38, 
    fontWeight: '700' as const,
    fontFamily: 'Fraunces_700Bold',
  },
  title1: { 
    fontSize: 28, 
    lineHeight: 34, 
    fontWeight: '700' as const,
    fontFamily: 'Fraunces_700Bold',
  },
  title2: { 
    fontSize: 22, 
    lineHeight: 28, 
    fontWeight: '600' as const,
    fontFamily: 'Fraunces_600SemiBold',
  },
  headline: { 
    fontSize: 17, 
    lineHeight: 22, 
    fontWeight: '600' as const,
    fontFamily: 'Nunito_600SemiBold',
  },
  body: { 
    fontSize: 16, 
    lineHeight: 24, 
    fontWeight: '400' as const,
    fontFamily: 'Nunito_400Regular',
  },
  callout: { 
    fontSize: 15, 
    lineHeight: 20, 
    fontWeight: '400' as const,
    fontFamily: 'Nunito_400Regular',
  },
  caption: { 
    fontSize: 13, 
    lineHeight: 18, 
    fontWeight: '400' as const,
    fontFamily: 'Nunito_400Regular',
  },
} as const;

export const motion = {
  fast: 150,
  normal: 200,
  slow: 250,
} as const;
