import type { AndroidSymbol } from 'expo-symbols';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Pressable, StyleSheet } from 'react-native';

import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

const profileIcon = {
  ios: 'person.crop.circle' as SFSymbol,
  android: 'account_circle' as AndroidSymbol,
  web: 'account_circle' as AndroidSymbol,
};

/**
 * Profile / settings entry — not a sixth tab.
 */
export function ProfileButton() {
  const { colors } = useTheme();

  return (
    <Link href="/profile" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account and settings"
        hitSlop={hitSlop}
        testID="profile-button"
        style={({ pressed }) => [
          ensureMinTouchTarget(styles.button),
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <SymbolView
          name={profileIcon}
          size={28}
          tintColor={colors.textPrimary}
        />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
