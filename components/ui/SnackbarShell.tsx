import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

export type SnackbarShellProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  visible?: boolean;
  testID?: string;
};

/**
 * Snackbar shell for short confirmations and Undo.
 * Presentation only in W1 — wire actions in later workstreams.
 */
export function SnackbarShell({
  message,
  actionLabel,
  onAction,
  visible = true,
  testID = 'snackbar-shell',
}: SnackbarShellProps) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      testID={testID}
      style={[
        styles.shell,
        {
          backgroundColor: colors.textPrimary,
        },
      ]}
    >
      <Text
        variant="callout"
        style={[styles.message, { color: colors.canvas }]}
        numberOfLines={2}
      >
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={hitSlop}
          onPress={onAction}
          testID={`${testID}-action`}
          style={({ pressed }) => [
            ensureMinTouchTarget(styles.action),
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text variant="callout" style={{ color: colors.brand.yolk }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.control,
    minHeight: 48,
  },
  message: {
    flex: 1,
  },
  action: {
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
