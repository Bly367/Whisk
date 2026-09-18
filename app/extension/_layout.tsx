import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Desktop/web + deep-link shell for extension capture (P2-W7).
 * Not a marketing rebuild of the five tabs — capture → preview only.
 */
export default function ExtensionLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
          color: colors.textPrimary,
        },
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="capture" options={{ title: 'Extension capture' }} />
    </Stack>
  );
}
