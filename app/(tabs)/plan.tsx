import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MacroStrip, scaleNutrition, sumNutrition } from '../../components/MacroStrip';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { dateKey, weekDates } from '../../services/mealPlan/dates';
import { resolveRecipeNutrition } from '../../services/nutrition/estimateFromIngredients';
import { useRecipeStore } from '../../store/recipeStore';
import { MealType, Nutrition } from '../../types/recipe';

const meals: { type: MealType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { type: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' },
  { type: 'dinner', label: 'Dinner', icon: 'moon-outline' },
];

interface PickerTarget {
  date: string;
  mealType: MealType;
  label: string;
}

function emptyNutrition(): Nutrition {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

export default function PlanScreen() {
  const recipes = useRecipeStore((state) => state.recipes);
  const mealPlan = useRecipeStore((state) => state.mealPlan);
  const setMealPlanRecipe = useRecipeStore((state) => state.setMealPlanRecipe);
  const removeMealPlanRecipe = useRecipeStore((state) => state.removeMealPlanRecipe);
  const [weekOffset, setWeekOffset] = useState(0);
  const [picker, setPicker] = useState<PickerTarget>();
  const [selectedServings, setSelectedServings] = useState(2);
  const dates = useMemo(() => weekDates(weekOffset), [weekOffset]);
  const dateIds = useMemo(() => new Set(dates.map(dateKey)), [dates]);
  const todayKey = dateKey(new Date());
  const plannedCount = mealPlan.filter((slot) => dateIds.has(slot.date)).length;

  const dailyMacros = useMemo(() => {
    const map = new Map<string, Nutrition>();
    for (const date of dates) {
      const id = dateKey(date);
      const dayNutrition: Nutrition[] = [];
      for (const meal of meals) {
        const slot = mealPlan.find((item) => item.date === id && item.mealType === meal.type);
        const recipe = recipes.find((item) => item.id === slot?.recipeId);
        const resolved = recipe ? resolveRecipeNutrition(recipe) : undefined;
        if (slot && recipe && resolved) {
          dayNutrition.push(
            scaleNutrition(resolved.nutrition, slot.servings),
          );
        }
      }
      map.set(id, dayNutrition.length ? sumNutrition(dayNutrition) : emptyNutrition());
    }
    return map;
  }, [dates, mealPlan, recipes]);

  const weekMacros = useMemo(
    () => sumNutrition([...dailyMacros.values()]),
    [dailyMacros],
  );
  const hasWeekMacros = weekMacros.calories > 0;

  const assignRecipe = (recipeId: string, servings = selectedServings) => {
    if (!picker) return;
    setMealPlanRecipe(picker.date, picker.mealType, recipeId, servings);
    setPicker(undefined);
  };

  const weekLabel = `${dates[0].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${dates[6].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Meal Plan"
        subtitle={`${plannedCount} meals · ${weekLabel}`}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.weekControls}>
          <Pressable
            onPress={() => setWeekOffset((value) => value - 1)}
            style={styles.weekButton}
            accessibilityLabel="Previous week"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setWeekOffset(0)} style={styles.weekLabelButton}>
            <Text style={styles.weekLabel}>{weekLabel}</Text>
            {weekOffset !== 0 ? <Text style={styles.todayHint}>Jump to this week</Text> : null}
          </Pressable>
          <Pressable
            onPress={() => setWeekOffset((value) => value + 1)}
            style={styles.weekButton}
            accessibilityLabel="Next week"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        {hasWeekMacros ? (
          <MacroStrip nutrition={weekMacros} showBars label="Week totals" />
        ) : (
          <View style={styles.emptyMacros}>
            <Ionicons name="nutrition-outline" size={22} color={colors.textMuted} />
            <Text style={styles.emptyMacrosText}>
              Plan meals with nutrition data to see weekly macros here.
            </Text>
          </View>
        )}

        <View style={styles.days}>
          {dates.map((date) => {
            const id = dateKey(date);
            const isToday = id === todayKey;
            const dayNutrition = dailyMacros.get(id) ?? emptyNutrition();
            const hasMacros = dayNutrition.calories > 0;

            return (
              <View key={id} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayHeading}>
                    <View style={styles.dayTitleRow}>
                      <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                        {date.toLocaleDateString(undefined, { weekday: 'long' })}
                      </Text>
                      {isToday ? (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>Today</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.dayDate}>
                      {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  {hasMacros ? <MacroStrip nutrition={dayNutrition} compact /> : null}
                </View>

                <View style={styles.meals}>
                  {meals.map((meal) => {
                    const slot = mealPlan.find(
                      (item) => item.date === id && item.mealType === meal.type,
                    );
                    const recipe = recipes.find((item) => item.id === slot?.recipeId);
                    const resolved = recipe ? resolveRecipeNutrition(recipe) : undefined;
                    const mealMacros =
                      slot && recipe && resolved
                        ? scaleNutrition(resolved.nutrition, slot.servings)
                        : null;

                    return (
                      <Pressable
                        key={meal.type}
                        onPress={() => {
                          setSelectedServings(slot?.servings ?? recipe?.servings ?? 2);
                          setPicker({ date: id, mealType: meal.type, label: meal.label });
                        }}
                        onLongPress={() => removeMealPlanRecipe(id, meal.type)}
                        style={[styles.mealSlot, recipe && styles.mealSlotFilled]}
                        accessibilityLabel={`${meal.label} on ${id}${
                          recipe ? `, ${recipe.title}` : ', empty'
                        }`}
                      >
                        <View style={styles.mealTop}>
                          <Ionicons
                            name={meal.icon}
                            size={14}
                            color={recipe ? colors.accent : colors.textMuted}
                          />
                          <Text style={styles.mealLabel}>{meal.label}</Text>
                        </View>
                        <Text
                          style={[styles.mealRecipe, !recipe && styles.mealRecipeEmpty]}
                          numberOfLines={2}
                        >
                          {recipe ? recipe.title : 'Add meal'}
                        </Text>
                        {recipe && slot ? (
                          <View style={styles.mealMeta}>
                            <Text style={styles.servings}>{slot.servings} servings</Text>
                            {mealMacros ? (
                              <Text style={styles.mealCal}>
                                {Math.round(mealMacros.calories)} cal
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        <Pressable onPress={() => router.push('/(tabs)/lists')} style={styles.listLink}>
          <View style={styles.listLinkIcon}>
            <Ionicons name="cart-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.listLinkCopy}>
            <Text style={styles.listLinkText}>Grocery list</Text>
            <Text style={styles.listLinkSub}>Merged from this week's plan</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.note}>Long-press a planned meal to remove it.</Text>
      </ScrollView>

      <Modal visible={Boolean(picker)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {picker ? `${picker.label} · ${picker.date}` : 'Pick a recipe'}
            </Text>
            <View style={styles.servingsRow}>
              <Text style={styles.servingsLabel}>Servings for this meal</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setSelectedServings((value) => Math.max(1, value - 1))}
                  style={styles.stepBtn}
                  accessibilityLabel="Decrease servings"
                >
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <Text style={styles.servingsCount}>{selectedServings}</Text>
                <Pressable
                  onPress={() => setSelectedServings((value) => value + 1)}
                  style={styles.stepBtn}
                  accessibilityLabel="Increase servings"
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>
            <ScrollView style={styles.modalList}>
              {recipes.length ? (
                recipes.map((recipe) => {
                  const resolved = resolveRecipeNutrition(recipe);
                  const scaled = resolved
                    ? scaleNutrition(resolved.nutrition, selectedServings)
                    : null;
                  return (
                    <Pressable
                      key={recipe.id}
                      onPress={() => assignRecipe(recipe.id, selectedServings)}
                      style={styles.modalRow}
                      accessibilityLabel={`Plan ${recipe.title} for ${selectedServings} servings`}
                    >
                      <View style={styles.modalRecipeCopy}>
                        <Text style={styles.modalRecipe}>{recipe.title}</Text>
                        <Text style={styles.modalMeta}>
                          {selectedServings} servings
                          {scaled ? ` · ${Math.round(scaled.calories)} cal` : ''}
                          {scaled ? ` · ${Math.round(scaled.protein)}g protein` : ''}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setSelectedServings(recipe.servings)}
                        hitSlop={8}
                        accessibilityLabel={`Use recipe default of ${recipe.servings} servings`}
                      >
                        <Ionicons name="refresh" size={16} color={colors.textMuted} />
                      </Pressable>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.empty}>No saved recipes yet. Import one first.</Text>
              )}
            </ScrollView>
            {picker &&
            mealPlan.some(
              (slot) => slot.date === picker.date && slot.mealType === picker.mealType,
            ) ? (
              <Pressable
                onPress={() => {
                  removeMealPlanRecipe(picker.date, picker.mealType);
                  setPicker(undefined);
                }}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>Remove planned meal</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setPicker(undefined)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  weekControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekLabelButton: { alignItems: 'center', gap: 2 },
  weekLabel: { ...typography.subtitle, color: colors.text },
  todayHint: { ...typography.caption, color: colors.accent, fontSize: 10 },
  emptyMacros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyMacrosText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  days: { gap: spacing.md },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  dayCardToday: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  dayHeader: {
    gap: spacing.sm,
  },
  dayHeading: { gap: 2 },
  dayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayName: { ...typography.subtitle, color: colors.text, fontSize: 16 },
  dayNameToday: { color: colors.accent },
  todayBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  todayBadgeText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 9,
  },
  dayDate: { ...typography.caption, color: colors.textMuted },
  meals: { flexDirection: 'row', gap: spacing.sm },
  mealSlot: {
    flex: 1,
    minHeight: 108,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.sm,
    gap: 4,
  },
  mealSlotFilled: {
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  mealTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealLabel: { ...typography.label, color: colors.textMuted, fontSize: 9 },
  mealRecipe: { ...typography.caption, color: colors.text, fontSize: 12, lineHeight: 16, flexGrow: 1 },
  mealRecipeEmpty: { color: colors.textMuted },
  mealMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    paddingTop: spacing.xs,
  },
  servings: { ...typography.caption, color: colors.accent, fontSize: 10 },
  mealCal: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  listLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listLinkCopy: { flex: 1, gap: 2 },
  listLinkText: { ...typography.subtitle, color: colors.text, fontSize: 15 },
  listLinkSub: { ...typography.caption, color: colors.textMuted },
  note: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '75%',
    gap: spacing.md,
  },
  modalTitle: { ...typography.subtitle, color: colors.text },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  servingsLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsCount: {
    ...typography.subtitle,
    color: colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  modalList: { maxHeight: 390 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRecipeCopy: { flex: 1, gap: 2 },
  modalRecipe: { ...typography.body, color: colors.text },
  modalMeta: { ...typography.caption, color: colors.textMuted },
  removeButton: { alignItems: 'center', paddingVertical: spacing.sm },
  removeText: { ...typography.caption, color: colors.danger },
  modalClose: { alignItems: 'center', paddingVertical: spacing.sm },
  modalCloseText: { ...typography.caption, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
});
