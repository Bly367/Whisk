import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useRecipeStore } from '../store/recipeStore';

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const userId = useAuthStore((state) => state.user?.id);
  const connectSync = useRecipeStore((state) => state.connectSync);
  const syncToCloud = useRecipeStore((state) => state.syncToCloud);

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    const connect = () => {
      void connectSync(userId ?? null);
    };
    if (useRecipeStore.persist.hasHydrated()) {
      connect();
      return;
    }
    return useRecipeStore.persist.onFinishHydration(connect);
  }, [userId, connectSync]);

  useEffect(() => {
    if (!userId) return;
    const retryIfPending = (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      const { syncPending, syncStatus } = useRecipeStore.getState();
      if (syncPending || syncStatus === 'error') {
        void syncToCloud(userId);
      }
    };
    const subscription = AppState.addEventListener('change', retryIfPending);
    return () => subscription.remove();
  }, [userId, syncToCloud]);

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
        <Stack.Screen name="folders" />
      </Stack>
    </GestureHandlerRootView>
  );
}
