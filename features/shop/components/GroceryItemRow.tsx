import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { GroceryItem } from '@/data/contracts';
import { radius, spacing, touchTarget } from '@/constants/tokens';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';
import { isMergedItem } from '@/features/shop/groupItems';

export type GroceryItemRowProps = {
  item: GroceryItem;
  onToggleComplete: (item: GroceryItem) => void;
  onUnmerge?: (item: GroceryItem) => void;
  onDelete?: (item: GroceryItem) => void;
  testID?: string;
};

export function GroceryItemRow({
  item,
  onToggleComplete,
  onUnmerge,
  onDelete,
  testID,
}: GroceryItemRowProps) {
  const { colors } = useTheme();
  const merged = isMergedItem(item);
  const qtyLabel = [item.quantity, item.unit].filter(Boolean).join(' ');

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      testID={testID}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.isCompleted }}
        accessibilityLabel={`${item.name}${qtyLabel ? `, ${qtyLabel}` : ''}`}
        hitSlop={hitSlop}
        onPress={() => onToggleComplete(item)}
        testID={testID ? `${testID}-check` : undefined}
        style={({ pressed }) => [
          ensureMinTouchTarget(styles.checkHit),
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: item.isCompleted ? colors.success : colors.border,
              backgroundColor: item.isCompleted ? colors.success : 'transparent',
            },
          ]}
        />
      </Pressable>

      <View style={styles.body}>
        <Text
          variant="headline"
          style={item.isCompleted ? styles.struck : undefined}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        {qtyLabel ? (
          <Text variant="callout" tone="secondary">
            {qtyLabel}
          </Text>
        ) : null}
        {item.recipeTitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            From {item.recipeTitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {merged && onUnmerge && !item.isCompleted ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Split ${item.name}`}
            hitSlop={hitSlop}
            onPress={() => onUnmerge(item)}
            testID={testID ? `${testID}-split` : undefined}
            style={({ pressed }) => [
              ensureMinTouchTarget(styles.action),
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text variant="caption" tone="info">
              Split
            </Text>
          </Pressable>
        ) : null}
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name}`}
            hitSlop={hitSlop}
            onPress={() => onDelete(item)}
            testID={testID ? `${testID}-remove` : undefined}
            style={({ pressed }) => [
              ensureMinTouchTarget(styles.action),
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text variant="caption" tone="error">
              Remove
            </Text>
          </Pressable>
        ) : null}
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
  checkHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  struck: {
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  action: {
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
