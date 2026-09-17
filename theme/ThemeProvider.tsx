import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { getThemeColors, type ColorSchemeName, type ThemeColors } from '@/theme/colors';

type ThemeContextValue = {
  scheme: ColorSchemeName;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme();
  const scheme: ColorSchemeName = system === 'dark' ? 'dark' : 'light';

  const value = useMemo(
    () => ({
      scheme,
      colors: getThemeColors(scheme),
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within AppThemeProvider');
  }
  return ctx;
}
