import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useRecipeStore } from '../../store/recipeStore';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlanScreen() {
  const recipes = useRecipeStore((state) => state.recipes);
  const mealPlan = useRecipeStore((state) => state.mealPlan);
  const setMealPlanRecipe = useRecipeStore((state) => state.setMealPlanRecipe);
  const syncToCloud = useRecipeStore((state) => state.syncToCloud);
  const user = useAuthStore((state) => state.user);
  const [pickerDay, setPickerDay] = useState<number | null>(null);

  const plannedCount = useMemo(
    () => mealPlan.filter((slot) => slot.recipeId).length,
    [mealPlan],
  );

  const assignRecipe = (recipeId: string) => {
    if (pickerDay === null) return;
    setMealPlanRecipe(pickerDay, recipeId);
    if (user) void syncToCloud(user.id);
    setPickerDay(null);
  };

  const clearDay = (dayIndex: number) => {
    setMealPlanRecipe(dayIndex, null);
    if (user) void syncToCloud(user.id);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Meal Plan"
        subtitle={`${plannedCount} of 7 nights planned · tap a day to assign a recipe`}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.calendar}>
          {days.map((day, dayIndex) => {
            const recipe = recipes.find((item) => item.id === mealPlan[dayIndex]?.recipeId);
            return (
              <Pressable
                key={day}
                onPress={() => setPickerDay(dayIndex)}
                onLongPress={() => clearDay(dayIndex)}
                style={styles.dayCol}
              >
                <Text style={styles.dayLabel}>{day}</Text>
                <View style={[styles.slot, recipe && styles.slotFilled]}>
                  {recipe ? (
                    <>
                      <Text style={styles.recipeTitle} numberOfLines={3}>
                        {recipe.title}
                      </Text>
                      <Text style={styles.recipeMeta}>{recipe.servings} servings</Text>
                    </>
                  ) : (
                    <Text style={styles.slotText}>+ Add meal</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => router.push('/(tabs)/lists')} style={styles.listLink}>
          <Ionicons name="cart-outline" size={18} color={colors.accent} />
          <Text style={styles.listLinkText}>View grocery list from this plan</Text>
        </Pressable>

        <Text style={styles.note}>Long-press a day to clear it.</Text>
      </ScrollView>

      <Modal visible={pickerDay !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Pick a recipe for {pickerDay !== null ? days[pickerDay] : ''}
            </Text>
            <ScrollView style={styles.modalList}>
              {recipes.length ? (
                recipes.map((recipe) => (
                  <Pressable key={recipe.id} onPress={() => assignRecipe(recipe.id)} style={styles.modalRow}>
                    <Text style={styles.modalRecipe}>{recipe.title}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))
              ) : (
                <Text style={styles.empty}>No saved recipes yet. Import one first.</Text>
              )}
            </ScrollView>
            <Pressable onPress={() => setPickerDay(null)} style={styles.modalClose}>
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
  calendar: { flexDirection: 'row', gap: spacing.sm },
  dayCol: { flex: 1, gap: spacing.sm },
  dayLabel: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 10,
  },
  slot: {
    minHeight: 100,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: colors.accentSoft,
    backgroundColor: colors.surfaceRaised,
  },
  slotText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  recipeTitle: { ...typography.caption, color: colors.text, textAlign: 'center', fontWeight: '600' },
  recipeMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4, fontSize: 11 },
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
    maxHeight: '70%',
    gap: spacing.md,
  },
  modalTitle: { ...typography.subtitle, color: colors.text },
  modalList: { maxHeight: 360 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRecipe: { ...typography.body, color: colors.text, flex: 1 },
  modalClose: { alignItems: 'center', paddingVertical: spacing.sm },
  modalCloseText: { ...typography.caption, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
});
