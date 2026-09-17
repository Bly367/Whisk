import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { createOfflineReader, getDatabase, getRepositories } from '@/data';
import type { RecipeWithIngredients } from '@/data/contracts';
import { useCookProgressStore } from '@/features/cook/cookProgressStore';
import { useKeepAwakeWhileCooking } from '@/features/cook/useKeepAwakeWhileCooking';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Cook mode — step focus, large Back/Next, keep-awake, persisted progress.
 * No upgrade / paywall chrome here (trust: never interrupt mid-cook).
 */
export default function CookModeScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { colors } = useTheme();
  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  const hydrateProgress = useCookProgressStore((s) => s.hydrate);
  const getProgress = useCookProgressStore((s) => s.getProgress);
  const setStep = useCookProgressStore((s) => s.setStep);
  const clearProgress = useCookProgressStore((s) => s.clearProgress);

  useKeepAwakeWhileCooking(Boolean(recipe) && !done);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateProgress();
      if (!recipeId || cancelled) return;
      const reader = createOfflineReader(getDatabase());
      const loaded = reader.getRecipe(recipeId);
      if (cancelled) return;
      setRecipe(loaded);
      const saved = getProgress(recipeId);
      if (saved) {
        setStepIndex(saved.stepIndex);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId, hydrateProgress, getProgress]);

  const steps = recipe?.instructions ?? [];
  const total = steps.length;
  const current = steps[stepIndex];
  const isLast = total > 0 && stepIndex >= total - 1;

  const progressLabel = useMemo(() => {
    if (total === 0) return 'No steps';
    return `Step ${stepIndex + 1} of ${total}`;
  }, [stepIndex, total]);

  const persist = useCallback(
    async (nextIndex: number) => {
      if (!recipeId) return;
      setStepIndex(nextIndex);
      await setStep(recipeId, nextIndex);
    },
    [recipeId, setStep],
  );

  const goBack = useCallback(() => {
    if (stepIndex <= 0) return;
    void persist(stepIndex - 1);
  }, [persist, stepIndex]);

  const goNext = useCallback(async () => {
    if (!recipe || !recipeId) return;
    if (isLast) {
      getRepositories().recipes.update(recipe.id, {
        cookedAt: new Date().toISOString(),
      });
      await clearProgress(recipeId);
      setDone(true);
      return;
    }
    await persist(stepIndex + 1);
  }, [clearProgress, isLast, persist, recipe, recipeId, stepIndex]);

  if (!ready) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} testID="cook-loading">
        <Text variant="body" tone="secondary">
          Opening cook mode…
        </Text>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} testID="cook-missing">
        <Stack.Screen options={{ title: 'Cook' }} />
        <Text variant="title2">Recipe not found</Text>
        <Text variant="body" tone="secondary">
          It may have been deleted. Your other recipes stay on this device.
        </Text>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.canvas }]}
        testID="cook-complete"
      >
        <Stack.Screen options={{ title: recipe.title }} />
        <Text variant="title1">Nice work</Text>
        <Text variant="body" tone="secondary">
          {recipe.title} is marked as recently cooked. Screen can sleep again.
        </Text>
        <Button
          label="Done"
          testID="cook-done"
          onPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.safe, { backgroundColor: colors.canvas }]}
      testID="screen-cook"
    >
      <Stack.Screen
        options={{
          title: recipe.title,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.textPrimary,
        }}
      />

      <View style={styles.header}>
        <Text
          variant="caption"
          tone="secondary"
          accessibilityRole="header"
          testID="cook-progress-label"
        >
          {progressLabel}
        </Text>
        <View
          style={[styles.track, { backgroundColor: colors.sunken }]}
          accessibilityElementsHidden
        >
          <View
            style={[
              styles.fill,
              {
                backgroundColor: colors.brand.yolk,
                width: total === 0 ? '0%' : `${((stepIndex + 1) / total) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.stepBody} accessibilityLiveRegion="polite">
        {total === 0 ? (
          <Text variant="title2" tone="secondary">
            This recipe has no steps yet. Add directions from the recipe editor.
          </Text>
        ) : (
          <>
            <Text
              variant="title1"
              testID="cook-step-text"
              accessibilityLabel={`${progressLabel}. ${current?.text ?? ''}`}
            >
              {current?.text}
            </Text>
            {recipe.ingredients.length > 0 ? (
              <View
                style={[
                  styles.ingredients,
                  { backgroundColor: colors.sunken, borderColor: colors.border },
                ]}
              >
                <Text variant="caption" tone="secondary">
                  Ingredients nearby
                </Text>
                <Text variant="callout">
                  {recipe.ingredients
                    .slice(0, 6)
                    .map((i) =>
                      [i.quantity, i.unit, i.name].filter(Boolean).join(' '),
                    )
                    .join(' · ')}
                  {recipe.ingredients.length > 6 ? '…' : ''}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous step"
          accessibilityState={{ disabled: stepIndex === 0 }}
          disabled={stepIndex === 0}
          hitSlop={hitSlop}
          onPress={goBack}
          testID="cook-back"
          style={({ pressed }) =>
            ensureMinTouchTarget({
              ...styles.navBtn,
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: stepIndex === 0 ? 0.4 : pressed ? 0.85 : 1,
            })
          }
        >
          <Text variant="headline">Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Finish cooking' : 'Next step'}
          hitSlop={hitSlop}
          onPress={() => void goNext()}
          testID="cook-next"
          style={({ pressed }) =>
            ensureMinTouchTarget({
              ...styles.navBtn,
              ...styles.nextBtn,
              backgroundColor: colors.brand.yolk,
              opacity: pressed ? 0.9 : 1,
            })
          }
        >
          <Text variant="headline" style={{ color: colors.textOnYolk }}>
            {isLast || total === 0 ? 'Finish' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  stepBody: {
    flex: 1,
    gap: spacing.xl,
    justifyContent: 'center',
  },
  ingredients: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  navBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  nextBtn: {
    flex: 1.4,
    borderWidth: 0,
  },
});
