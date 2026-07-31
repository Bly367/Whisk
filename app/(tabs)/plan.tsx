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
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { dateKey, weekDates } from '../../services/mealPlan/dates';
import { useRecipeStore } from '../../store/recipeStore';
import { MealType } from '../../types/recipe';

const meals: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
];

interface PickerTarget {
  date: string;
  mealType: MealType;
  label: string;
}

export default function PlanScreen() {
  const recipes = useRecipeStore((state) => state.recipes);
  const mealPlan = useRecipeStore((state) => state.mealPlan);
  const setMealPlanRecipe = useRecipeStore((state) => state.setMealPlanRecipe);
  const removeMealPlanRecipe = useRecipeStore((state) => state.removeMealPlanRecipe);
  const [weekOffset, setWeekOffset] = useState(0);
  const [picker, setPicker] = useState<PickerTarget>();
  const dates = useMemo(() => weekDates(weekOffset), [weekOffset]);
  const dateIds = useMemo(() => new Set(dates.map(dateKey)), [dates]);
  const plannedCount = mealPlan.filter((slot) => dateIds.has(slot.date)).length;

  const assignRecipe = (recipeId: string, servings: number) => {
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
        subtitle={`${plannedCount} meals planned for ${weekLabel}`}
      />
      <ScrollView contentContainerStyle={styles.content}>
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
            {weekOffset !== 0 ? <Text style={styles.todayHint}>Tap for this week</Text> : null}
          </Pressable>
          <Pressable
            onPress={() => setWeekOffset((value) => value + 1)}
            style={styles.weekButton}
            accessibilityLabel="Next week"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.days}>
          {dates.map((date) => {
            const id = dateKey(date);
            return (
              <View key={id} style={styles.dayCard}>
                <View style={styles.dayHeading}>
                  <Text style={styles.dayName}>
                    {date.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text style={styles.dayDate}>
                    {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.meals}>
                  {meals.map((meal) => {
                    const slot = mealPlan.find(
                      (item) => item.date === id && item.mealType === meal.type,
                    );
                    const recipe = recipes.find((item) => item.id === slot?.recipeId);
                    return (
                      <Pressable
                        key={meal.type}
                        onPress={() =>
                          setPicker({ date: id, mealType: meal.type, label: meal.label })
                        }
                        onLongPress={() => removeMealPlanRecipe(id, meal.type)}
                        style={[styles.mealSlot, recipe && styles.mealSlotFilled]}
                        accessibilityLabel={`${meal.label} on ${id}${
                          recipe ? `, ${recipe.title}` : ', empty'
                        }`}
                      >
                        <Text style={styles.mealLabel}>{meal.label}</Text>
                        <Text
                          style={[styles.mealRecipe, !recipe && styles.mealRecipeEmpty]}
                          numberOfLines={2}
                        >
                          {recipe ? recipe.title : 'Add meal'}
                        </Text>
                        {recipe && slot ? (
                          <Text style={styles.servings}>{slot.servings} servings</Text>
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
          <Ionicons name="cart-outline" size={18} color={colors.accent} />
          <Text style={styles.listLinkText}>View grocery list from this plan</Text>
        </Pressable>
        <Text style={styles.note}>Long-press a planned meal to remove it.</Text>
      </ScrollView>

      <Modal visible={Boolean(picker)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {picker ? `${picker.label} · ${picker.date}` : 'Pick a recipe'}
            </Text>
            <ScrollView style={styles.modalList}>
              {recipes.length ? (
                recipes.map((recipe) => (
                  <Pressable
                    key={recipe.id}
                    onPress={() => assignRecipe(recipe.id, recipe.servings)}
                    style={styles.modalRow}
                  >
                    <View style={styles.modalRecipeCopy}>
                      <Text style={styles.modalRecipe}>{recipe.title}</Text>
                      <Text style={styles.modalMeta}>{recipe.servings} servings</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))
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
  days: { gap: spacing.sm },
  dayCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  dayHeading: { width: 58, justifyContent: 'center' },
  dayName: { ...typography.label, color: colors.text },
  dayDate: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  meals: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  mealSlot: {
    flex: 1,
    minHeight: 74,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.sm,
    justifyContent: 'center',
  },
  mealSlotFilled: {
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  mealLabel: { ...typography.label, color: colors.textMuted, fontSize: 8 },
  mealRecipe: { ...typography.caption, color: colors.text, marginTop: 3, fontSize: 12 },
  mealRecipeEmpty: { color: colors.textMuted },
  servings: { ...typography.caption, color: colors.accent, fontSize: 9, marginTop: 2 },
  listLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listLinkText: { ...typography.body, color: colors.accent, fontSize: 14 },
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
  modalList: { maxHeight: 390 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRecipeCopy: { flex: 1 },
  modalRecipe: { ...typography.body, color: colors.text },
  modalMeta: { ...typography.caption, color: colors.textMuted },
  removeButton: { alignItems: 'center', paddingVertical: spacing.sm },
  removeText: { ...typography.caption, color: colors.danger },
  modalClose: { alignItems: 'center', paddingVertical: spacing.sm },
  modalCloseText: { ...typography.caption, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
});
