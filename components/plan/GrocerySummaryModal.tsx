import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type GrocerySummaryLine = {
  recipeId: string;
  recipeTitle: string;
  mealCount: number;
  ingredientCount: number;
};

export type GrocerySummaryModalProps = {
  visible: boolean;
  lines: GrocerySummaryLine[];
  totalIngredients: number;
  onClose: () => void;
  onConfirm: () => void;
  confirming?: boolean;
  testID?: string;
};

export function GrocerySummaryModal({
  visible,
  lines,
  totalIngredients,
  onClose,
  onConfirm,
  confirming = false,
  testID = 'grocery-summary',
}: GrocerySummaryModalProps) {
  const { colors } = useTheme();

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
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          testID={testID}
        >
          <Text variant="title2">Create grocery list</Text>
          <Text variant="body" tone="secondary">
            {lines.length === 0
              ? 'Add meals to this week first — then we can summarize what to shop for.'
              : `About to add ${totalIngredients} ingredient line${totalIngredients === 1 ? '' : 's'} from ${lines.length} recipe${lines.length === 1 ? '' : 's'}. Quantities are scaled by how many times each recipe appears this week.`}
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {lines.map((line) => (
              <View
                key={line.recipeId}
                style={[
                  styles.row,
                  { backgroundColor: colors.sunken, borderColor: colors.border },
                ]}
                testID={`${testID}-line-${line.recipeId}`}
              >
                <Text variant="headline" numberOfLines={2}>
                  {line.recipeTitle}
                </Text>
                <Text variant="caption" tone="secondary">
                  {line.mealCount} meal{line.mealCount === 1 ? '' : 's'} this week ·{' '}
                  {line.ingredientCount} ingredient
                  {line.ingredientCount === 1 ? '' : 's'}
                  {line.mealCount > 1 ? ' (quantities × meals)' : ''}
                </Text>
              </View>
            ))}
          </ScrollView>

          <Button
            label={
              lines.length === 0
                ? 'Nothing to add yet'
                : `Add ${totalIngredients} items`
            }
            disabled={lines.length === 0 || confirming}
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
