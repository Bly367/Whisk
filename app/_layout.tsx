import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="cook/[id]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/url" />
        <Stack.Screen name="import/manual" />
        <Stack.Screen name="import/shared" />
        <Stack.Screen name="import/review" />
      </Stack>
    </GestureHandlerRootView>
  );
}
