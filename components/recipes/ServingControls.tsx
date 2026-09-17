import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { scaleQuantityDisplay } from '@/features/recipes/scale';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

export type ServingStepperProps = {
  servings: number;
  onChange: (next: number) => void;
  baseServings: number | null;
  testID?: string;
};

export function ServingStepper({
  servings,
  onChange,
  baseServings,
  testID = 'serving-stepper',
}: ServingStepperProps) {
  const { colors } = useTheme();
  const base = baseServings && baseServings > 0 ? baseServings : servings;

  return (
    <View style={styles.wrap} testID={testID}>
      <Text variant="callout">Servings</Text>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease servings"
          hitSlop={hitSlop}
          onPress={() => onChange(Math.max(1, servings - 1))}
          testID={`${testID}-dec`}
          style={(state) =>
            ensureMinTouchTarget({
              ...styles.step,
              backgroundColor: colors.sunken,
              borderColor: colors.border,
              opacity: state.pressed ? 0.85 : 1,
            })
          }
        >
          <Text variant="headline">−</Text>
        </Pressable>
        <Text variant="headline" style={styles.value} accessibilityLabel={`${servings} servings`}>
          {servings}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase servings"
          hitSlop={hitSlop}
          onPress={() => onChange(servings + 1)}
          testID={`${testID}-inc`}
          style={(state) =>
            ensureMinTouchTarget({
              ...styles.step,
              backgroundColor: colors.sunken,
              borderColor: colors.border,
              opacity: state.pressed ? 0.85 : 1,
            })
          }
        >
          <Text variant="headline">+</Text>
        </Pressable>
      </View>
      {base !== servings ? (
        <Text variant="caption" tone="secondary">
          Original recipe: {base} servings
        </Text>
      ) : null}
    </View>
  );
}

export type IngredientLineProps = {
  name: string;
  quantity?: string | null;
  unit?: string | null;
  note?: string | null;
  baseServings: number | null;
  targetServings: number;
  testID?: string;
};

export function IngredientLine({
  name,
  quantity,
  unit,
  note,
  baseServings,
  targetServings,
  testID,
}: IngredientLineProps) {
  const { colors } = useTheme();
  const scaled = scaleQuantityDisplay(quantity, baseServings, targetServings);
  // Always show the recipe’s written unit — no label remap without conversion.
  const displayUnit = unit?.trim() || null;

  const amount = [scaled.scaled, displayUnit].filter(Boolean).join(' ');

  return (
    <View style={[styles.ingredient, { borderColor: colors.border }]} testID={testID}>
      <Text variant="body">
        {amount ? `${amount} ` : ''}
        {name}
        {note ? ` (${note})` : ''}
      </Text>
      {scaled.isScaled && scaled.original ? (
        <Text variant="caption" tone="secondary" testID={testID ? `${testID}-original` : undefined}>
          Originally {scaled.original}
          {unit ? ` ${unit}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  step: {
    width: 48,
    height: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 32,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  ingredient: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
});
