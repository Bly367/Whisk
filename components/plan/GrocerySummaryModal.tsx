import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import type { GroceryGeneratePreview } from '@/features/shop/generateFromPlan';
import { useTheme } from '@/theme/ThemeProvider';

export function grocerySummaryPreviewLines(preview: GroceryGeneratePreview): string[] {
  return preview.drafts.map((draft) =>
    [draft.quantity, draft.unit, draft.name].filter(Boolean).join(' '),
  );
}

export function grocerySummaryReplaceMessage(preview: GroceryGeneratePreview): string {
  return `This replaces this week's list with ${preview.drafts.length} ingredient item${preview.drafts.length === 1 ? '' : 's'} from ${preview.recipeCount} recipe${preview.recipeCount === 1 ? '' : 's'}.`;
}

export type GrocerySummaryModalProps = {
  visible: boolean;
  preview: GroceryGeneratePreview | null;
  onClose: () => void;
  onConfirm: () => void;
  confirming?: boolean;
  testID?: string;
};

export function GrocerySummaryModal({
  visible,
  preview,
  onClose,
  onConfirm,
  confirming = false,
  testID = 'grocery-summary',
}: GrocerySummaryModalProps) {
  const { colors } = useTheme();
  const summaryLines = preview ? grocerySummaryPreviewLines(preview) : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID={testID}
        >
          <Text variant="title2">Create grocery list</Text>
          <Text variant="body" tone="secondary">
            {!preview
              ? 'Add meals to this week first — then we can summarize what to shop for.'
              : grocerySummaryReplaceMessage(preview)}
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {preview?.drafts.map((draft, index) => (
              <View
                key={`${draft.mergeKey}-${index}`}
                style={[styles.row, { backgroundColor: colors.sunken, borderColor: colors.border }]}
                testID={`${testID}-line-${index}`}
              >
                <Text variant="headline" numberOfLines={2}>
                  {summaryLines[index]}
                </Text>
                <Text variant="caption" tone="secondary">
                  {draft.recipeTitle ? `From ${draft.recipeTitle}` : 'From this week’s plan'}
                </Text>
              </View>
            ))}
          </ScrollView>

          <Button
            label={!preview ? 'Nothing to add yet' : `Replace with ${preview.drafts.length} items`}
            disabled={!preview || confirming}
            loading={confirming}
            onPress={onConfirm}
            testID={`${testID}-confirm`}
          />
          <Button
            label="Cancel"
            variant="secondary"
            onPress={onClose}
            testID={`${testID}-cancel`}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  list: {
    maxHeight: 280,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: 4,
  },
});
