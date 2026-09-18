import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { EntryOptionsModal } from '@/components/plan/EntryOptionsModal';
import { GrocerySummaryModal } from '@/components/plan/GrocerySummaryModal';
import { ApplyTemplateModal } from '@/components/plan/ApplyTemplateModal';
import { LeftoversTargetModal } from '@/components/plan/LeftoversTargetModal';
import { SaveTemplateModal } from '@/components/plan/SaveTemplateModal';
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
  MealPlanTemplate,
  MealPlanWithEntries,
  MealSlot,
  RecipeListItem,
} from '@/data/contracts';
import { getRepositories, reportLocalPersistFailure, reportLocalPersistSuccess } from '@/data';
import {
  applyTemplateToWeek,
  defaultLaterTargetDate,
  filterLaterWeekDates,
  previewApplyTemplate,
  saveSelectionAsTemplate,
  saveWeekAsTemplate,
  scheduleLeftovers,
  undoApplyTemplate,
  undoScheduleLeftovers,
  type TemplateApplyPreview,
} from '@/features/plan-templates';
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
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [entryAction, setEntryAction] = useState<EntryActionTarget | null>(null);
  const [groceryOpen, setGroceryOpen] = useState(false);
  const [groceryBusy, setGroceryBusy] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveSelectionIds, setSaveSelectionIds] = useState<string[] | null>(null);
  const [saveTemplateDefaultName, setSaveTemplateDefaultName] = useState('');
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<TemplateApplyPreview | null>(null);
  const [leftoversSource, setLeftoversSource] = useState<EntryActionTarget | null>(null);
  const [leftoversDate, setLeftoversDate] = useState<string | null>(null);
  const [leftoversSlot, setLeftoversSlot] = useState<MealSlot>('lunch');
  const [snack, setSnack] = useState<PlanSnack | null>(null);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const recipesById = useMemo(() => recipeTitleMap(recipes), [recipes]);

  const reload = useCallback(() => {
    try {
      const { mealPlans, recipes: recipeRepo, templates: templateRepo } = getRepositories();
      const nextPlan = mealPlans.getOrCreateForWeek(weekStart);
      const nextRecipes = recipeRepo.list({ status: 'published', sort: 'newest' });
      setPlan(nextPlan);
      setRecipes(nextRecipes);
      setTemplates(templateRepo.list());
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

  const openPlanLeftovers = () => {
    if (!entryAction) return;
    const sourceDate = entryAction.planDate;
    setLeftoversSource(entryAction);
    // Never fall back to an earlier weekday (e.g. Monday when source is Sunday).
    setLeftoversDate(defaultLaterTargetDate(sourceDate, days));
    setLeftoversSlot('lunch');
    setEntryAction(null);
  };

  const leftoversLaterDays = useMemo(() => {
    if (!leftoversSource) return [];
    return filterLaterWeekDates(leftoversSource.planDate, days);
  }, [leftoversSource, days]);

  const confirmLeftovers = () => {
    if (!leftoversSource || !leftoversDate) return;
    const source = leftoversSource;
    const targetDate = leftoversDate;
    const targetSlot = leftoversSlot;
    try {
      const result = scheduleLeftovers(getRepositories(), {
        sourceMealPlanEntryId: source.entryId,
        targetPlanDate: targetDate,
        targetSlot,
        label: `${source.recipeTitle} leftovers`,
      });
      reportLocalPersistSuccess();
      reload();
      showSnack({
        message: 'Leftovers added',
        actionLabel: 'Undo',
        onAction: () => {
          persist(() => {
            undoScheduleLeftovers(getRepositories(), result);
          }, { message: 'Leftovers removed' });
        },
      });
      setLeftoversSource(null);
    } catch (error) {
      reportLocalPersistFailure(
        error instanceof Error ? error.message : 'Could not schedule leftovers',
      );
      showSnack({ message: 'Could not schedule leftovers.' });
    }
  };

  const confirmSaveTemplate = (name: string) => {
    if (!plan) return;
    const selectionIds = saveSelectionIds;
    persist(
      () => {
        if (selectionIds && selectionIds.length > 0) {
          saveSelectionAsTemplate(getRepositories(), {
            name,
            weekStart,
            entryIds: selectionIds,
            sourceMealPlanId: plan.id,
          });
        } else {
          saveWeekAsTemplate(getRepositories(), {
            name,
            mealPlanId: plan.id,
            weekStart,
          });
        }
      },
      { message: `Saved “${name}” template` },
    );
    setSaveTemplateOpen(false);
    setSaveSelectionIds(null);
  };

  const selectTemplateForPreview = (templateId: string) => {
    try {
      const preview = previewApplyTemplate(getRepositories(), {
        templateId,
        targetWeekStart: weekStart,
      });
      setTemplatePreview(preview);
    } catch (error) {
      showSnack({
        message: error instanceof Error ? error.message : 'Could not preview template.',
      });
    }
  };

  const confirmApplyTemplate = () => {
    if (!templatePreview) return;
    const preview = templatePreview;
    try {
      const applied = applyTemplateToWeek(getRepositories(), {
        templateId: preview.templateId,
        targetWeekStart: weekStart,
      });
      reportLocalPersistSuccess();
      reload();
      showSnack({
        message: `Applied “${preview.templateName}”`,
        actionLabel: 'Undo',
        onAction: () => {
          persist(() => {
            undoApplyTemplate(getRepositories(), applied);
          }, { message: 'Template apply undone' });
        },
      });
      setApplyTemplateOpen(false);
      setTemplatePreview(null);
    } catch (error) {
      reportLocalPersistFailure(
        error instanceof Error ? error.message : 'Could not apply template',
      );
      showSnack({ message: 'Could not apply template.' });
    }
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
          label="Save week as template"
          variant="secondary"
          onPress={() => {
            setSaveSelectionIds(null);
            setSaveTemplateDefaultName(`Week of ${formatWeekRange(weekStart)}`);
            setSaveTemplateOpen(true);
          }}
          disabled={!plan || isEmpty}
          testID="plan-save-template"
        />
        <Button
          label="Apply template"
          variant="secondary"
          onPress={() => {
            setTemplatePreview(null);
            setApplyTemplateOpen(true);
          }}
          testID="plan-apply-template"
        />
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
        onPlanLeftovers={openPlanLeftovers}
        onSaveAsTemplate={() => {
          if (!entryAction) return;
          setSaveSelectionIds([entryAction.entryId]);
          setSaveTemplateDefaultName(`${entryAction.recipeTitle} template`);
          setEntryAction(null);
          setSaveTemplateOpen(true);
        }}
        onMoveToDay={moveToDay}
        onChangeSlot={changeSlot}
      />

      <SaveTemplateModal
        visible={saveTemplateOpen}
        defaultName={saveTemplateDefaultName || `Week of ${formatWeekRange(weekStart)}`}
        selectionCount={saveSelectionIds?.length}
        onClose={() => {
          setSaveTemplateOpen(false);
          setSaveSelectionIds(null);
        }}
        onSave={confirmSaveTemplate}
      />

      <ApplyTemplateModal
        visible={applyTemplateOpen}
        templates={templates}
        preview={templatePreview}
        targetWeekLabel={formatWeekRange(weekStart)}
        onClose={() => {
          setApplyTemplateOpen(false);
          setTemplatePreview(null);
        }}
        onSelectTemplate={selectTemplateForPreview}
        onConfirmApply={confirmApplyTemplate}
        onClearPreview={() => setTemplatePreview(null)}
      />

      <LeftoversTargetModal
        visible={leftoversSource !== null}
        recipeTitle={leftoversSource?.recipeTitle ?? 'this meal'}
        weekDates={leftoversLaterDays}
        selectedDate={leftoversDate}
        selectedSlot={leftoversSlot}
        onSelectDate={setLeftoversDate}
        onSelectSlot={setLeftoversSlot}
        onClose={() => setLeftoversSource(null)}
        onConfirm={confirmLeftovers}
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
    gap: spacing.sm,
  },
});
