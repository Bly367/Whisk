export const colors = {
  bg: '#08080A',
  surface: '#121214',
  surfaceRaised: '#1A1A1E',
  surfaceGlass: 'rgba(26, 26, 30, 0.72)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  text: '#F5F5F7',
  textSecondary: '#8E8E93',
  textMuted: '#636366',
  accent: '#FF6B4A',
  accentSoft: 'rgba(255, 107, 74, 0.16)',
  accentAlt: '#FFB347',
  success: '#5FD68A',
  danger: '#FF5C5C',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
};

export const typography = {
  hero: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  subtitle: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '500' as const },
  label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};
