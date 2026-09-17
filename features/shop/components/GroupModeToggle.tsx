import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing, touchTarget } from '@/constants/tokens';
import type { ShopGroupMode } from '@/features/shop/groupItems';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

export type GroupModeToggleProps = {
  mode: ShopGroupMode;
  onChange: (mode: ShopGroupMode) => void;
};

export function GroupModeToggle({ mode, onChange }: GroupModeToggleProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.sunken, borderColor: colors.border }]}
      accessibilityRole="tablist"
      testID="shop-group-toggle"
    >
      {(
        [
          { id: 'aisle', label: 'By aisle' },
          { id: 'recipe', label: 'By recipe' },
        ] as const
      ).map((option) => {
        const selected = mode === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            hitSlop={hitSlop}
            onPress={() => onChange(option.id)}
            testID={`shop-group-${option.id}`}
            style={({ pressed }) => [
              ensureMinTouchTarget(styles.tab),
              {
                backgroundColor: selected ? colors.card : 'transparent',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text
              variant="callout"
              style={{ color: selected ? colors.textPrimary : colors.textSecondary }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control - 2,
    paddingHorizontal: spacing.md,
  },
});
