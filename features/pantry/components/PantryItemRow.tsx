import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { PantryItem } from '@/data/contracts';
import { radius, spacing, touchTarget } from '@/constants/tokens';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

export type PantryItemRowProps = {
  item: PantryItem;
  onConsume: (item: PantryItem) => void;
  onEdit: (item: PantryItem) => void;
  testID?: string;
};

export function PantryItemRow({ item, onConsume, onEdit, testID }: PantryItemRowProps) {
  const { colors } = useTheme();
  const qtyLabel = [item.quantity, item.unit].filter(Boolean).join(' ');
  const depleted = Boolean(item.depletedAt);

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: depleted ? 0.55 : 1,
        },
      ]}
      testID={testID}
    >
      <View style={styles.body}>
        <Text variant="headline" numberOfLines={2}>
          {item.name}
        </Text>
        {qtyLabel ? (
          <Text variant="callout" tone="secondary">
            {qtyLabel}
          </Text>
        ) : null}
        {item.notes ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}
        {depleted ? (
          <Text variant="caption" tone="warning">
            Used up
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {!depleted ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mark ${item.name} as used up`}
            hitSlop={hitSlop}
            onPress={() => onConsume(item)}
            testID={testID ? `${testID}-consume` : undefined}
            style={({ pressed }) => [
              ensureMinTouchTarget(styles.action),
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text variant="caption" tone="info">
              Use up
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          hitSlop={hitSlop}
          onPress={() => onEdit(item)}
          testID={testID ? `${testID}-edit` : undefined}
          style={({ pressed }) => [
            ensureMinTouchTarget(styles.action),
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text variant="caption" tone="secondary">
            Edit
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: touchTarget.min,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    maxWidth: 180,
  },
  action: {
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
