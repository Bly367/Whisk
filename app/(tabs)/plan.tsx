import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { EntryOptionsModal } from '@/components/plan/EntryOptionsModal';
import { GrocerySummaryModal } from '@/components/plan/GrocerySummaryModal';
import {
  MEAL_SLOTS,
  buildGroceryPreview,
  entriesForDaySlot,
  recipeTitleMap,
  slotLabel,
} from '@/components/plan/planHelpers';
import {
  usePlanUiStore,
  type EntryActionTarget,
  type PickerTarget,
} from '@/components/plan/planUiStore';
import { RecipePickerModal } from '@/components/plan/RecipePickerModal';
import { formatWeekRange, weekDays } from '@/components/plan/weekUtils';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { SnackbarShell } from '@/components/ui/SnackbarShell';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import type {
  MealPlanEntry,
  MealPlanWithEntries,
  MealSlot,
  RecipeListItem,
} from '@/data/contracts';
import { getRepositories, reportLocalPersistFailure, reportLocalPersistSuccess } from '@/data';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

type PlanSnack = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function PlanScreen() {
  const { colors } = useTheme();
  const weekStart = usePlanUiStore((s) => s.weekStart);
  const shiftWeek = usePlanUiStore((s) => s.shiftWeek);
  const goToCurrentWeek = usePlanUiStore((s) => s.goToCurrentWeek);

  const [plan, setPlan] = useState<MealPlanWithEntries | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [entryAction, setEntryAction] = useState<EntryActionTarget | null>(null);
  const [groceryOpen, setGroceryOpen] = useState(false);
  const [groceryBusy, setGroceryBusy] = useState(false);
  const [snack, setSnack] = useState<PlanSnack | null>(null);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const recipesById = useMemo(() => recipeTitleMap(recipes), [recipes]);

  const reload = useCallback(() => {
    try {
      const { mealPlans, recipes: recipeRepo } = getRepositories();
      const nextPlan = mealPlans.getOrCreateForWeek(weekStart);
      const nextRecipes = recipeRepo.list({ status: 'published', sort: 'newest' });
      setPlan(nextPlan);
      setRecipes(nextRecipes);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load this week’s plan.');
    }
  }, [weekStart]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(() => setSnack(null), 4000);
    return () => clearTimeout(t);
  }, [snack]);

  const showSnack = useCallback((next: PlanSnack) => {
    setSnack(next);
  }, []);

  const persist = useCallback(
    (action: () => void, success?: PlanSnack) => {
      try {
        action();
        reportLocalPersistSuccess();
        reload();
        if (success) showSnack(success);
      } catch (error) {
        reportLocalPersistFailure(
          error instanceof Error ? error.message : 'Could not save meal plan',
        );
        showSnack({ message: 'Could not save on this device.' });
      }
    },
    [reload, showSnack],
  );

  const openPicker = (planDate: string, slot: MealSlot) => {
    setPicker({ planDate, slot });
  };

  const addRecipe = (recipe: RecipeListItem) => {
    if (!plan || !picker) return;
    const target = picker;
    persist(
      () => {
        const { mealPlans } = getRepositories();
        const existing = entriesForDaySlot(plan.entries, target.planDate, target.slot);
        mealPlans.addEntry({
          mealPlanId: plan.id,
          recipeId: recipe.id,
          planDate: target.planDate,
          slot: target.slot,
          position: existing.length,
        });
      },
      { message: `Added ${recipe.title}` },
    );
    setPicker(null);
  };

  const restoreEntry = useCallback(
    (snapshot: MealPlanEntry) => {
      persist(
        () => {
          getRepositories().mealPlans.addEntry({
            mealPlanId: snapshot.mealPlanId,
            recipeId: snapshot.recipeId,
            planDate: snapshot.planDate,
            slot: snapshot.slot,
            note: snapshot.note,
            position: snapshot.position,
          });
        },
        { message: 'Meal restored' },
      );
    },
    [persist],
  );

  const removeEntryConfirmed = useCallback(
    (entryId: string) => {
      if (!plan) return;
      const source = plan.entries.find((e) => e.id === entryId);
      if (!source) return;
      const snapshot: MealPlanEntry = { ...source };
      persist(
        () => {
          getRepositories().mealPlans.removeEntry(entryId);
        },
        {
          message: 'Meal removed',
          actionLabel: 'Undo',
          onAction: () => restoreEntry(snapshot),
        },
      );
      setEntryAction(null);
    },
    [plan, persist, restoreEntry],
  );

  const removeEntry = (entryId: string) => {
    const title =
      entryAction?.recipeTitle ?? plan?.entries.find((e) => e.id === entryId)?.note ?? 'this meal';
    Alert.alert('Remove meal?', `Remove ${title} from this week’s plan?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeEntryConfirmed(entryId),
      },
    ]);
  };

  const duplicateEntry = () => {
    if (!plan || !entryAction) return;
    const source = plan.entries.find((e) => e.id === entryAction.entryId);
    if (!source) return;
    persist(
      () => {
        const { mealPlans } = getRepositories();
        const siblings = entriesForDaySlot(plan.entries, source.planDate, source.slot);
        mealPlans.addEntry({
          mealPlanId: plan.id,
          recipeId: source.recipeId,
          planDate: source.planDate,
          slot: source.slot,
          note: source.note,
          position: siblings.length,
        });
      },
      { message: 'Meal duplicated' },
    );
    setEntryAction(null);
  };

  const moveToDay = (planDate: string) => {
    if (!entryAction) return;
    persist(
      () => {
        getRepositories().mealPlans.updateEntry(entryAction.entryId, { planDate });
      },
      { message: 'Meal moved' },
    );
    setEntryAction(null);
  };

  const changeSlot = (slot: MealSlot) => {
    if (!entryAction) return;
    persist(
      () => {
        getRepositories().mealPlans.updateEntry(entryAction.entryId, { slot });
      },
      { message: 'Slot updated' },
    );
    setEntryAction(null);
  };

  const groceryPreview = useMemo(() => {
    if (!plan) return [];
    const { recipes: recipeRepo } = getRepositories();
    return buildGroceryPreview(plan.entries, recipesById, (recipeId) => {
      const full = recipeRepo.getById(recipeId);
      return (full?.ingredients ?? []).map((ing) => ({
        name: ing.name,
        quantity: ing.quantity ?? null,
        unit: ing.unit ?? null,
        aisle: ing.aisle ?? null,
      }));
    });
  }, [plan, recipesById]);

  const totalIngredients = groceryPreview.reduce((sum, line) => sum + line.ingredientCount, 0);

  const confirmGrocery = () => {
    if (!plan || groceryPreview.length === 0) return;
    setGroceryBusy(true);
    try {
      const { grocery } = getRepositories();
      const items = groceryPreview.flatMap((line) =>
        line.ingredients.map((ing, index) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          aisle: ing.aisle,
          recipeId: line.recipeId,
          recipeTitle: line.recipeTitle,
          mergeKey: `${line.recipeId}:${ing.name.toLowerCase()}`,
          position: index,
        })),
      );
      grocery.create({
        name: `Week of ${formatWeekRange(weekStart)}`,
        mealPlanId: plan.id,
        items,
      });
      reportLocalPersistSuccess();
      setGroceryOpen(false);
      // Stay on Plan — Shop list UI lands with W6; avoid false-success navigation.
      showSnack({
        message: `${totalIngredients} item${totalIngredients === 1 ? '' : 's'} saved to Groceries. Find them on the Shop tab once list view ships.`,
      });
    } catch (error) {
      reportLocalPersistFailure(
        error instanceof Error ? error.message : 'Could not create grocery list',
      );
      showSnack({ message: 'Could not create grocery list.' });
    } finally {
      setGroceryBusy(false);
    }
  };

  const isEmpty = (plan?.entries.length ?? 0) === 0;

  return (
    <Screen testID="screen-plan" style={styles.screen}>
      <View style={styles.header}>
        <Text variant="title1">This week’s plan</Text>
        <Text variant="body" tone="secondary">
          Breakfast, lunch, dinner, and snacks when you want them — empty slots are fine.
        </Text>
      </View>

      <View style={styles.weekBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          hitSlop={hitSlop}
          testID="plan-week-prev"
          onPress={() => shiftWeek(-1)}
          style={({ pressed }) => [
            ensureMinTouchTarget(styles.weekNav),
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text variant="callout">Prev</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Current range ${formatWeekRange(weekStart)}. Jump to this week.`}
          hitSlop={hitSlop}
          testID="plan-week-current"
          onPress={goToCurrentWeek}
          style={styles.weekLabel}
        >
          <Text variant="headline">{formatWeekRange(weekStart)}</Text>
          <Text variant="caption" tone="secondary">
            Tap to jump to this week
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          hitSlop={hitSlop}
          testID="plan-week-next"
          onPress={() => shiftWeek(1)}
          style={({ pressed }) => [
            ensureMinTouchTarget(styles.weekNav),
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text variant="callout">Next</Text>
        </Pressable>
      </View>

      {loadError ? (
        <View
          style={[styles.errorBox, { backgroundColor: colors.sunken, borderColor: colors.border }]}
        >
          <Text variant="body" tone="error">
            {loadError}
          </Text>
          <Button label="Try again" variant="secondary" onPress={reload} />
        </View>
      ) : null}

      {isEmpty && !loadError ? (
        <View
          style={[styles.empty, { backgroundColor: colors.sunken, borderColor: colors.border }]}
          testID="plan-empty"
        >
          <View
            style={[styles.chickDot, { backgroundColor: colors.brand.chick }]}
            accessible={false}
            importantForAccessibility="no"
          />
          <Text variant="headline">Your week is open</Text>
          <Text variant="body" tone="secondary">
            Add a meal from your recipe library whenever you’re ready. No need to fill every slot.
          </Text>
        </View>
      ) : null}

      {days.map((day) => (
        <View
          key={day.date}
          style={[
            styles.dayCard,
            {
              backgroundColor: colors.card,
              borderColor: day.isToday ? colors.brand.yolk : colors.border,
            },
          ]}
          testID={`plan-day-${day.date}`}
        >
          <View style={styles.dayHeader}>
            <Text variant="headline">{day.label}</Text>
            {day.isToday ? (
              <Text variant="caption" tone="info">
                Today
              </Text>
            ) : null}
          </View>

          {MEAL_SLOTS.map(({ slot, label }) => {
            const slotEntries = entriesForDaySlot(plan?.entries ?? [], day.date, slot);
            return (
              <View key={slot} style={styles.slotBlock} testID={`plan-slot-${day.date}-${slot}`}>
                <View style={styles.slotHeader}>
                  <Text variant="callout" tone="secondary">
                    {label}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${label.toLowerCase()} on ${day.shortLabel}`}
                    hitSlop={hitSlop}
                    testID={`plan-add-${day.date}-${slot}`}
                    onPress={() => openPicker(day.date, slot)}
                    style={({ pressed }) => [
                      ensureMinTouchTarget(styles.addChip),
                      {
                        backgroundColor: colors.brand.yolkSoft,
                        borderColor: colors.brand.yolk,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text variant="callout">Add</Text>
                  </Pressable>
                </View>

                {slotEntries.length === 0 ? (
                  <Text variant="caption" tone="secondary" style={styles.slotHint}>
                    Optional
                  </Text>
                ) : (
                  slotEntries.map((entry) => {
                    const title =
                      (entry.recipeId && recipesById.get(entry.recipeId)?.title) ||
                      entry.note ||
                      'Meal';
                    return (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${title}, ${slotLabel(entry.slot)}. Open meal options.`}
                        accessibilityHint="Move, duplicate, or remove"
                        hitSlop={hitSlop}
                        testID={`plan-entry-${entry.id}`}
                        onPress={() =>
                          setEntryAction({
                            entryId: entry.id,
                            recipeTitle: title,
                            planDate: entry.planDate,
                            slot: entry.slot,
                          })
                        }
                        style={({ pressed }) => [
                          ensureMinTouchTarget(styles.entryRow),
                          {
                            backgroundColor: colors.sunken,
                            borderColor: colors.border,
                            opacity: pressed ? 0.9 : 1,
                          },
                        ]}
                      >
                        <Text variant="body" numberOfLines={2} style={styles.entryTitle}>
                          {title}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          Options
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.footerCta}>
        <Button
          label="Create grocery list"
          onPress={() => setGroceryOpen(true)}
          testID="plan-create-grocery"
        />
      </View>

      {snack ? (
        <SnackbarShell
          message={snack.message}
          actionLabel={snack.actionLabel}
          onAction={snack.onAction}
          visible
          testID="plan-snackbar"
        />
      ) : null}

      <RecipePickerModal
        visible={picker !== null}
        title={picker ? `Add ${slotLabel(picker.slot).toLowerCase()}` : 'Add meal'}
        recipes={recipes}
        onClose={() => setPicker(null)}
        onSelect={addRecipe}
      />

      <EntryOptionsModal
        visible={entryAction !== null}
        recipeTitle={entryAction?.recipeTitle ?? ''}
        currentSlot={entryAction?.slot ?? 'dinner'}
        weekDates={days}
        onClose={() => setEntryAction(null)}
        onDuplicate={duplicateEntry}
        onRemove={() => entryAction && removeEntry(entryAction.entryId)}
        onMoveToDay={moveToDay}
        onChangeSlot={changeSlot}
      />

      <GrocerySummaryModal
        visible={groceryOpen}
        lines={groceryPreview}
        totalIngredients={totalIngredients}
        confirming={groceryBusy}
        onClose={() => setGroceryOpen(false)}
        onConfirm={confirmGrocery}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekNav: {
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    minHeight: 48,
    justifyContent: 'center',
  },
  empty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  chickDot: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dayCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  slotBlock: {
    gap: spacing.sm,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotHint: {
    paddingLeft: spacing.xs,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  entryTitle: {
    flex: 1,
  },
  footerCta: {
    marginTop: spacing.sm,
  },
});
