import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/tokens';
import type { GroceryGeneratePreview } from '@/features/shop/generateFromPlan';
import { useTheme } from '@/theme/ThemeProvider';

export type GeneratePreviewCardProps = {
  preview: GroceryGeneratePreview;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
};

export function GeneratePreviewCard({
  preview,
  onConfirm,
  onCancel,
  confirming = false,
}: GeneratePreviewCardProps) {
  const { colors } = useTheme();
  const sample = preview.drafts.slice(0, 5);

  return (
    <View
      style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.sunken }]}
      testID="shop-generate-preview"
      accessibilityRole="summary"
    >
      <Text variant="title2">{preview.listName}</Text>
      <Text variant="body" tone="secondary">
        {preview.drafts.length} items from {preview.recipeCount} recipe
        {preview.recipeCount === 1 ? '' : 's'}
        {preview.mergedCount > 0 ? ` · ${preview.mergedCount} merged where quantities matched` : ''}
      </Text>

      <View style={styles.sample}>
        {sample.map((draft, index) => (
          <Text key={`${draft.mergeKey}-${index}`} variant="callout">
            {[draft.quantity, draft.unit, draft.name].filter(Boolean).join(' ')}
            {draft.recipeTitle ? ` — ${draft.recipeTitle}` : ''}
          </Text>
        ))}
        {preview.drafts.length > sample.length ? (
          <Text variant="caption" tone="secondary">
            +{preview.drafts.length - sample.length} more
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={`Add ${preview.drafts.length} items`}
          onPress={onConfirm}
          loading={confirming}
          testID="shop-confirm-generate"
        />
        <Button
          label="Cancel"
          variant="tertiary"
          onPress={onCancel}
          disabled={confirming}
          testID="shop-cancel-generate"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sample: {
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
