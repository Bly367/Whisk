import { brand, darkPalette, lightPalette } from '@/constants/tokens';

export type ColorSchemeName = 'light' | 'dark';

export type ThemeColors = {
  brand: {
    yolk: string;
    yolkPressed: string;
    yolkSoft: string;
    yolkMuted: string;
    chick: string;
  };
  canvas: string;
  card: string;
  sunken: string;
  textPrimary: string;
  textSecondary: string;
  textOnYolk: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  tabInactive: string;
  tabBar: string;
  overlay: string;
};

export function getThemeColors(scheme: ColorSchemeName): ThemeColors {
  const palette = scheme === 'dark' ? darkPalette : lightPalette;
  const yolk = scheme === 'dark' ? brand.yolkMuted : brand.yolk;

  return {
    brand: {
      yolk,
      yolkPressed: brand.yolkPressed,
      yolkSoft: scheme === 'dark' ? brand.yolkSoftDark : brand.yolkSoft,
      yolkMuted: brand.yolkMuted,
      chick: brand.chick,
    },
    canvas: palette.surface.canvas,
    card: palette.surface.card,
    sunken: palette.surface.sunken,
    textPrimary: palette.text.primary,
    textSecondary: palette.text.secondary,
    textOnYolk: lightPalette.text.primary,
    border: palette.border.subtle,
    success: palette.semantic.success,
    warning: palette.semantic.warning,
    error: palette.semantic.error,
    info: palette.semantic.info,
    tabInactive: palette.text.secondary,
    tabBar: palette.surface.card,
    overlay: scheme === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(36,31,24,0.4)',
  };
}
