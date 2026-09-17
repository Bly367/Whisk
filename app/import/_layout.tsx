import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

export default function ImportLayout() {
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
      <Stack.Screen name="url" options={{ title: 'Paste a link' }} />
      <Stack.Screen name="share" options={{ title: 'Share sheet' }} />
      <Stack.Screen name="ocr" options={{ title: 'Scan a photo' }} />
      <Stack.Screen name="preview" options={{ title: 'Review import' }} />
      <Stack.Screen name="manual" options={{ title: 'Create manually' }} />
    </Stack>
  );
}
