import { SymbolView } from 'expo-symbols';
import type { AndroidSymbol } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { ProfileButton } from '@/components/ui/ProfileButton';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { touchTarget } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const tabMinHeight = Platform.OS === 'ios' ? touchTarget.ios : touchTarget.android;

type TabIconProps = {
  color: ColorValue;
  ios: SFSymbol;
  android: AndroidSymbol;
  web: AndroidSymbol;
};

function TabIcon({ color, ios, android, web }: TabIconProps) {
  return <SymbolView name={{ ios, android, web }} tintColor={color} size={26} />;
}

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand.yolk,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          minHeight: tabMinHeight + 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarItemStyle: {
          minHeight: tabMinHeight,
          paddingVertical: 4,
        },
        headerShown: useClientOnlyValue(false, true),
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '600',
          color: colors.textPrimary,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarButtonTestID: 'tab-home',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} ios="house.fill" android="home" web="home" />
          ),
          headerRight: () => <ProfileButton />,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarAccessibilityLabel: 'Recipes',
          tabBarButtonTestID: 'tab-recipes',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} ios="book.fill" android="menu_book" web="menu_book" />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarAccessibilityLabel: 'Add recipe',
          tabBarButtonTestID: 'tab-add',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} ios="plus.circle.fill" android="add_circle" web="add_circle" />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarAccessibilityLabel: 'Meal plan',
          tabBarButtonTestID: 'tab-plan',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} ios="calendar" android="calendar_today" web="calendar_today" />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarAccessibilityLabel: 'Grocery list',
          tabBarButtonTestID: 'tab-shop',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} ios="cart.fill" android="shopping_cart" web="shopping_cart" />
          ),
        }}
      />
    </Tabs>
  );
}
