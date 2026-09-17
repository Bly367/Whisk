import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import type { SessionMode } from '@/features/trust/sessionStore';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  mode: SessionMode;
  testID?: string;
};

export function GuestModeBanner({ mode, testID = 'guest-mode-banner' }: Props) {
  const { colors } = useTheme();
  const isGuest = mode === 'guest';

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      style={[
        styles.row,
        {
          backgroundColor: colors.sunken,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[styles.dot, { backgroundColor: isGuest ? colors.success : colors.info }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={styles.copy}>
        <Text variant="headline">{isGuest ? 'Guest · local only' : 'Signed in'}</Text>
        <Text variant="caption" tone="secondary">
          {isGuest
            ? 'Full core loop on this device — no account required. Recipes save locally and stay exportable.'
            : 'Your library syncs when cloud is available. Local copies remain the source of truth offline.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    marginTop: 6,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
});
