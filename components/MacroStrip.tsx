import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { Nutrition } from '../types/recipe';

export function scaleNutrition(nutrition: Nutrition, factor: number): Nutrition {
  return {
    calories: nutrition.calories * factor,
    protein: nutrition.protein * factor,
    carbs: nutrition.carbs * factor,
    fat: nutrition.fat * factor,
  };
}

export function sumNutrition(items: Nutrition[]): Nutrition {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

interface MacroStripProps {
  nutrition: Nutrition;
  compact?: boolean;
  showBars?: boolean;
  label?: string;
  onEdit?: () => void;
}

const MACRO_COLORS = {
  calories: colors.text,
  protein: colors.success,
  carbs: colors.accentAlt,
  fat: colors.accent,
};

export function MacroStrip({
  nutrition,
  compact = false,
  showBars = false,
  label,
  onEdit,
}: MacroStripProps) {
  const macros = [
    {
      key: 'calories',
      label: 'Cal',
      fullLabel: 'Calories',
      value: `${Math.round(nutrition.calories)}`,
      color: MACRO_COLORS.calories,
    },
    {
      key: 'protein',
      label: 'Protein',
      fullLabel: 'Protein',
      value: `${Math.round(nutrition.protein)}g`,
      color: MACRO_COLORS.protein,
    },
    {
      key: 'carbs',
      label: 'Carbs',
      fullLabel: 'Carbs',
      value: `${Math.round(nutrition.carbs)}g`,
      color: MACRO_COLORS.carbs,
    },
    {
      key: 'fat',
      label: 'Fat',
      fullLabel: 'Fat',
      value: `${Math.round(nutrition.fat)}g`,
      color: MACRO_COLORS.fat,
    },
  ] as const;

  if (compact) {
    return (
      <View style={styles.compactRow} accessibilityLabel={macroAccessibilityLabel(nutrition)}>
        {macros.map((macro) => (
          <Text key={macro.key} style={[styles.compactValue, { color: macro.color }]}>
            {macro.key === 'calories' ? macro.value : `${macro.label[0]} ${macro.value}`}
          </Text>
        ))}
      </View>
    );
  }

  const header = label || onEdit ? (
    <View style={styles.cardHeader}>
      {label ? <Text style={styles.cardLabel}>{label}</Text> : <View />}
      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Edit macros"
        >
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={styles.card}>
      {header}
      <View style={styles.row}>
        {macros.map((macro) => (
          <View key={macro.key} style={styles.item}>
            <Text style={styles.itemLabel}>{macro.fullLabel}</Text>
            <Text style={[styles.itemValue, { color: macro.color }]}>{macro.value}</Text>
          </View>
        ))}
      </View>
      {showBars ? (
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barSegment,
              {
                flex: Math.max(nutrition.protein * 4, 0.01),
                backgroundColor: MACRO_COLORS.protein,
              },
            ]}
          />
          <View
            style={[
              styles.barSegment,
              {
                flex: Math.max(nutrition.carbs * 4, 0.01),
                backgroundColor: MACRO_COLORS.carbs,
              },
            ]}
          />
          <View
            style={[
              styles.barSegment,
              {
                flex: Math.max(nutrition.fat * 9, 0.01),
                backgroundColor: MACRO_COLORS.fat,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function macroAccessibilityLabel(nutrition: Nutrition) {
  return `${Math.round(nutrition.calories)} calories, ${Math.round(nutrition.protein)}g protein, ${Math.round(nutrition.carbs)}g carbs, ${Math.round(nutrition.fat)}g fat`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardLabel: {
    ...typography.label,
    color: colors.textMuted,
    flex: 1,
  },
  editLink: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  itemLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
  },
  itemValue: {
    ...typography.subtitle,
    color: colors.text,
  },
  barTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    marginTop: spacing.xs,
    gap: 2,
  },
  barSegment: {
    height: '100%',
    borderRadius: radius.full,
  },
  compactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  compactValue: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
});
