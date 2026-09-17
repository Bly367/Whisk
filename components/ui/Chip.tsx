import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityHint?: string;
};

export function Chip({
  label,
  selected = false,
  onPress,
  testID,
  accessibilityHint,
}: ChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      accessibilityHint={accessibilityHint}
      hitSlop={hitSlop}
      disabled={!onPress}
      onPress={onPress}
      testID={testID}
      style={(state) =>
        ensureMinTouchTarget({
          ...styles.chip,
          backgroundColor: selected ? colors.brand.yolkSoft : colors.sunken,
          borderColor: selected ? colors.brand.yolk : colors.border,
          opacity: state.pressed ? 0.85 : 1,
        })
      }
    >
      <Text variant="callout" style={{ color: colors.textPrimary }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
