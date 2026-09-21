import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { DatabaseProvider } from '@/data/DatabaseProvider';
import { AppThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { useShareIntentHandler } from '@/import/shareIntentHandler';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AppThemeProvider>
      <DatabaseProvider>
        <RootNavigator />
      </DatabaseProvider>
    </AppThemeProvider>
  );
}

function RootNavigator() {
  const { scheme, colors } = useTheme();

  // Handle incoming OS share intents
  useShareIntentHandler();

  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.brand.yolk,
      background: colors.canvas,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.brand.yolk,
    },
  };

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="import" options={{ headerShown: false }} />
        <Stack.Screen name="extension" options={{ headerShown: false }} />
        <Stack.Screen
          name="recipe/[id]"
          options={{
            title: 'Recipe',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors.textPrimary,
          }}
        />
        <Stack.Screen
          name="recipe/edit/[id]"
          options={{
            title: 'Edit recipe',
            presentation: 'modal',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors.textPrimary,
          }}
        />
        <Stack.Screen
          name="cook/[recipeId]"
          options={{
            title: 'Cook',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors.textPrimary,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            title: 'Account',
            presentation: 'modal',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors.textPrimary,
          }}
        />
        <Stack.Screen
          name="pantry"
          options={{
            title: 'Pantry',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors.textPrimary,
          }}
        />
      </Stack>
    </NavThemeProvider>
  );
}
