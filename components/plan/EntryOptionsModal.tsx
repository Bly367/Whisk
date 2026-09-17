import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { MealSlot } from '@/data/contracts';
import { radius, spacing } from '@/constants/tokens';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

const SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: 'breakfast', label: 'Breakfast' },
  { slot: 'lunch', label: 'Lunch' },
  { slot: 'dinner', label: 'Dinner' },
  { slot: 'snack', label: 'Snack' },
];

export type EntryOptionsModalProps = {
  visible: boolean;
  recipeTitle: string;
  currentSlot: MealSlot;
  weekDates: { date: string; shortLabel: string }[];
  onClose: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMoveToDay: (planDate: string) => void;
  onChangeSlot: (slot: MealSlot) => void;
  testID?: string;
};

export function EntryOptionsModal({
  visible,
  recipeTitle,
  currentSlot,
  weekDates,
  onClose,
  onDuplicate,
  onRemove,
  onMoveToDay,
  onChangeSlot,
  testID = 'entry-options',
}: EntryOptionsModalProps) {
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
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
          testID={testID}
        >
          <Text variant="title2" numberOfLines={2}>
            {recipeTitle}
          </Text>
          <Text variant="caption" tone="secondary">
            Move, duplicate, or remove this meal.
          </Text>

          <Text variant="headline">Move to day</Text>
          <View style={styles.chipRow}>
            {weekDates.map((day) => (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={`Move to ${day.shortLabel}`}
                hitSlop={hitSlop}
                testID={`${testID}-day-${day.date}`}
                onPress={() => onMoveToDay(day.date)}
                style={({ pressed }) => [
                  ensureMinTouchTarget(styles.chip),
                  {
                    backgroundColor: colors.sunken,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text variant="caption">{day.shortLabel}</Text>
              </Pressable>
            ))}
          </View>

          <Text variant="headline">Change slot</Text>
          <View style={styles.chipRow}>
            {SLOTS.map(({ slot, label }) => {
              const active = slot === currentSlot;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  accessibilityLabel={`Change slot to ${label}`}
                  accessibilityState={{ selected: active }}
                  hitSlop={hitSlop}
                  testID={`${testID}-slot-${slot}`}
                  onPress={() => onChangeSlot(slot)}
                  style={({ pressed }) => [
                    ensureMinTouchTarget(styles.chip),
                    {
                      backgroundColor: active ? colors.brand.yolkSoft : colors.sunken,
                      borderColor: active ? colors.brand.yolk : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text variant="callout">{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            label="Duplicate meal"
            variant="secondary"
            onPress={onDuplicate}
            testID={`${testID}-duplicate`}
          />
          <Button
            label="Remove meal"
            variant="destructive"
            onPress={onRemove}
            testID={`${testID}-remove`}
          />
          <Button
            label="Cancel"
            variant="tertiary"
            onPress={onClose}
            testID={`${testID}-cancel`}
          />
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
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
