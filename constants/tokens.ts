/**
 * Yolk & Chick design tokens — single color source for Whisk UI chrome.
 * Prefer semantic theme colors in components; reach for brand tokens only when needed.
 */

export const brand = {
  yolk: '#F7B928',
  yolkPressed: '#D89400',
  yolkSoft: '#FFF1C2',
  yolkMuted: '#E5A820',
  chick: '#FFD968',
} as const;

export const lightPalette = {
  surface: {
    canvas: '#FFFDF8',
    card: '#FFFFFF',
    sunken: '#F6F2E9',
  },
  text: {
    primary: '#241F18',
    secondary: '#6B6257',
    inverse: '#FFFDF8',
  },
  border: {
    subtle: '#E8E0D4',
  },
  semantic: {
    success: '#247A4B',
    warning: '#A85F00',
    error: '#B42318',
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
    inverse: '#241F18',
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
  pill: 999,
} as const;

/** Platform minimums: 44 iOS / 48 Android — use the larger by default for shared chrome. */
export const touchTarget = {
  min: 48,
  ios: 44,
  android: 48,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
} as const;

export const motion = {
  fast: 150,
  normal: 200,
  slow: 250,
} as const;
