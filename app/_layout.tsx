import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../constants/theme';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, []);

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
        <Stack.Screen name="recipe/edit/[id]" />
        <Stack.Screen name="cook/[id]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/url" />
        <Stack.Screen name="import/manual" />
        <Stack.Screen name="import/photo" />
        <Stack.Screen name="import/shared" />
        <Stack.Screen name="import/review" />
        <Stack.Screen name="account" />
      </Stack>
    </GestureHandlerRootView>
  );
}
