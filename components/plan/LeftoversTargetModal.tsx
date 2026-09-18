import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { MealSlot } from '@/data/contracts';
import { MEAL_SLOTS } from '@/components/plan/planHelpers';
import { radius, spacing } from '@/constants/tokens';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

export type LeftoversTargetModalProps = {
  visible: boolean;
  recipeTitle: string;
  weekDates: { date: string; shortLabel: string }[];
  selectedDate: string | null;
  selectedSlot: MealSlot;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: MealSlot) => void;
  onClose: () => void;
  onConfirm: () => void;
  testID?: string;
};

export function LeftoversTargetModal({
  visible,
  recipeTitle,
  weekDates,
  selectedDate,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
  onClose,
  onConfirm,
  testID = 'leftovers-target',
}: LeftoversTargetModalProps) {
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
          <Text variant="title2">Plan leftovers</Text>
          <Text variant="caption" tone="secondary">
            Keeps {recipeTitle} on the source day and adds a leftovers slot later.
          </Text>

          <Text variant="headline">Day</Text>
          <View style={styles.chipRow}>
            {weekDates.map((day) => {
              const active = day.date === selectedDate;
              return (
                <Pressable
                  key={day.date}
                  accessibilityRole="button"
                  accessibilityLabel={`Leftovers on ${day.shortLabel}`}
                  accessibilityState={{ selected: active }}
                  hitSlop={hitSlop}
                  testID={`${testID}-day-${day.date}`}
                  onPress={() => onSelectDate(day.date)}
                  style={({ pressed }) => [
                    ensureMinTouchTarget(styles.chip),
                    {
                      backgroundColor: active ? colors.brand.yolkSoft : colors.sunken,
                      borderColor: active ? colors.brand.yolk : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text variant="caption">{day.shortLabel}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text variant="headline">Slot</Text>
          <View style={styles.chipRow}>
            {MEAL_SLOTS.map(({ slot, label }) => {
              const active = slot === selectedSlot;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  accessibilityLabel={`Leftovers ${label}`}
                  accessibilityState={{ selected: active }}
                  hitSlop={hitSlop}
                  testID={`${testID}-slot-${slot}`}
                  onPress={() => onSelectSlot(slot)}
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
            label="Add leftovers"
            onPress={onConfirm}
            disabled={!selectedDate}
            testID={`${testID}-confirm`}
          />
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
