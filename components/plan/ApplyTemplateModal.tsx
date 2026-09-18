import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { TemplateApplyPreview } from '@/features/plan-templates';
import type { MealPlanTemplate, MealSlot } from '@/data/contracts';
import { radius, spacing } from '@/constants/tokens';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';
import { slotLabel } from '@/components/plan/planHelpers';

export type ApplyTemplateModalProps = {
  visible: boolean;
  templates: MealPlanTemplate[];
  preview: TemplateApplyPreview | null;
  targetWeekLabel: string;
  onClose: () => void;
  onSelectTemplate: (templateId: string) => void;
  onConfirmApply: () => void;
  onClearPreview: () => void;
  testID?: string;
};

function formatPreviewLine(entry: TemplateApplyPreview['entries'][number]): string {
  const slot = slotLabel(entry.slot as MealSlot);
  return `${entry.planDate} · ${slot}`;
}

export function ApplyTemplateModal({
  visible,
  templates,
  preview,
  targetWeekLabel,
  onClose,
  onSelectTemplate,
  onConfirmApply,
  onClearPreview,
  testID = 'apply-template',
}: ApplyTemplateModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
          testID={testID}
        >
          <Text variant="title2">Apply template</Text>
          <Text variant="caption" tone="secondary">
            Preview onto {targetWeekLabel}, then confirm. Existing meals stay; conflicts are flagged.
          </Text>

          {preview ? (
            <View style={styles.previewBlock} testID={`${testID}-preview`}>
              <Text variant="headline">{preview.templateName}</Text>
              <Text variant="body" tone="secondary">
                {preview.entries.length} meal{preview.entries.length === 1 ? '' : 's'}
                {preview.conflictCount > 0
                  ? ` · ${preview.conflictCount} slot conflict${preview.conflictCount === 1 ? '' : 's'}`
                  : ' · no conflicts'}
              </Text>
              {preview.entries.slice(0, 6).map((entry, index) => (
                <Text key={`${entry.planDate}-${entry.slot}-${index}`} variant="caption">
                  {formatPreviewLine(entry)}
                </Text>
              ))}
              {preview.entries.length > 6 ? (
                <Text variant="caption" tone="secondary">
                  +{preview.entries.length - 6} more
                </Text>
              ) : null}
              <Button
                label="Apply to this week"
                onPress={onConfirmApply}
                testID={`${testID}-confirm`}
              />
              <Button
                label="Choose another"
                variant="secondary"
                onPress={onClearPreview}
                testID={`${testID}-back`}
              />
            </View>
          ) : (
            <FlatList
              data={templates}
              keyExtractor={(item) => item.id}
              style={styles.list}
              ListEmptyComponent={
                <Text variant="body" tone="secondary" testID={`${testID}-empty`}>
                  No templates yet. Save this week first.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Preview template ${item.name}`}
                  hitSlop={hitSlop}
                  testID={`${testID}-item-${item.id}`}
                  onPress={() => onSelectTemplate(item.id)}
                  style={({ pressed }) => [
                    ensureMinTouchTarget(styles.row),
                    {
                      backgroundColor: colors.sunken,
                      borderColor: colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text variant="body">{item.name}</Text>
                  <Text variant="caption" tone="secondary">
                    Preview
                  </Text>
                </Pressable>
              )}
            />
          )}

          <Button label="Cancel" variant="tertiary" onPress={onClose} testID={`${testID}-cancel`} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '80%',
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  previewBlock: {
    gap: spacing.sm,
  },
});
