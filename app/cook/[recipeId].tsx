import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { motion, radius, spacing } from '@/constants/tokens';
import { createOfflineReader, getDatabase, getRepositories } from '@/data';
import type { RecipeWithIngredients } from '@/data/contracts';
import { CookTimersPanel } from '@/features/cook/CookTimersPanel';
import {
  handsFreeNavFeedback,
  navigateCookStep,
} from '@/features/cook/cookStepNavigation';
import { useCookProgressStore } from '@/features/cook/cookProgressStore';
import { useCookTimerSession } from '@/features/cook/cookTimerSession';
import { useKeepAwakeWhileCooking } from '@/features/cook/useKeepAwakeWhileCooking';
import { motionDuration, useReduceMotion } from '@/hooks/useReduceMotion';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Cook mode — step focus, large Back/Next (hands-free targets), multi-timers,
 * keep-awake, persisted progress. No upgrade / paywall / chick chrome here.
 */
export default function CookModeScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const stepOpacity = useMemo(() => new Animated.Value(1), []);

  const hydrateProgress = useCookProgressStore((s) => s.hydrate);
  const getProgress = useCookProgressStore((s) => s.getProgress);
  const setStep = useCookProgressStore((s) => s.setStep);
  const clearProgress = useCookProgressStore((s) => s.clearProgress);
  const endTimerSession = useCookTimerSession((s) => s.endSession);

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

  useEffect(() => {
    return () => {
      endTimerSession();
    };
  }, [endTimerSession]);

  const steps = useMemo(() => recipe?.instructions ?? [], [recipe?.instructions]);
  const total = steps.length;
  const current = steps[stepIndex];
  const isLast = total > 0 && stepIndex >= total - 1;

  const progressLabel = useMemo(() => {
    if (total === 0) return 'No steps';
    return `Step ${stepIndex + 1} of ${total}`;
  }, [stepIndex, total]);

  const playStepTransition = useCallback(
    (didChange: boolean, announcement?: string) => {
      const feedback = handsFreeNavFeedback({ reduceMotion, didChange });
      if (feedback.announce && announcement) {
        AccessibilityInfo.announceForAccessibility(announcement);
      }
      if (!feedback.animateTransition) {
        stepOpacity.setValue(1);
        return;
      }
      stepOpacity.setValue(0.35);
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: motionDuration(motion.normal, reduceMotion),
        useNativeDriver: true,
      }).start();
    },
    [reduceMotion, stepOpacity],
  );

  const persist = useCallback(
    async (nextIndex: number) => {
      if (!recipeId) return;
      setStepIndex(nextIndex);
      await setStep(recipeId, nextIndex);
    },
    [recipeId, setStep],
  );

  const goBack = useCallback(() => {
    const result = navigateCookStep({ stepIndex, totalSteps: total, action: 'back' });
    const nextStep = steps[result.stepIndex];
    playStepTransition(
      result.didChange,
      result.didChange
        ? `Step ${result.stepIndex + 1} of ${total}. ${nextStep?.text ?? ''}`
        : undefined,
    );
    if (!result.didChange) return;
    void persist(result.stepIndex);
  }, [persist, playStepTransition, stepIndex, steps, total]);

  const goNext = useCallback(async () => {
    if (!recipe || !recipeId) return;
    if (isLast) {
      getRepositories().recipes.update(recipe.id, {
        cookedAt: new Date().toISOString(),
      });
      await clearProgress(recipeId);
      endTimerSession();
      setDone(true);
      return;
    }
    const result = navigateCookStep({ stepIndex, totalSteps: total, action: 'next' });
    const nextStep = steps[result.stepIndex];
    playStepTransition(
      result.didChange,
      result.didChange
        ? `Step ${result.stepIndex + 1} of ${total}. ${nextStep?.text ?? ''}`
        : undefined,
    );
    if (!result.didChange) return;
    await persist(result.stepIndex);
  }, [
    clearProgress,
    endTimerSession,
    isLast,
    persist,
    playStepTransition,
    recipe,
    recipeId,
    stepIndex,
    steps,
    total,
  ]);

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
        <Button label="Done" testID="cook-done" onPress={() => router.back()} />
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
        <View style={[styles.progressPill, { backgroundColor: colors.brand.yolk }]}>
          <Text
            variant="callout"
            accessibilityRole="header"
            testID="cook-progress-label"
            style={{ color: colors.textOnYolk }}
          >
            {progressLabel}
          </Text>
        </View>
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

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[styles.stepBody, { opacity: stepOpacity }]}
          accessibilityLiveRegion="polite"
          testID="cook-step-body"
        >
          {total === 0 ? (
            <Text variant="title2" tone="secondary">
              This recipe has no steps yet. Add directions from the recipe editor.
            </Text>
          ) : (
            <Text
              variant="title1"
              maxFontSizeMultiplier={1.5}
              testID="cook-step-text"
              accessibilityLabel={`${progressLabel}. ${current?.text ?? ''}`}
            >
              {current?.text}
            </Text>
          )}
        </Animated.View>

        {total > 0 && recipe.ingredients.length > 0 ? (
          <View
            style={[
              styles.ingredients,
              { backgroundColor: colors.sunken, borderColor: colors.border },
            ]}
          >
            <Text variant="caption" tone="secondary">
              Ingredients nearby
            </Text>
            <Text variant="callout" maxFontSizeMultiplier={1.3}>
              {recipe.ingredients
                .slice(0, 6)
                .map((i) => [i.quantity, i.unit, i.name].filter(Boolean).join(' '))
                .join(' · ')}
              {recipe.ingredients.length > 6 ? '…' : ''}
            </Text>
          </View>
        ) : null}

        {recipeId ? <CookTimersPanel recipeId={recipeId} /> : null}
      </ScrollView>

      <View style={styles.controls} testID="cook-hands-free-controls">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous step"
          accessibilityHint="Hands-free back"
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
          <Text variant="headline" maxFontSizeMultiplier={1.3}>Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Finish cooking' : 'Next step'}
          accessibilityHint="Hands-free next"
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
          <Text variant="headline" maxFontSizeMultiplier={1.3} style={{ color: colors.textOnYolk }}>
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
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
  },
  progressPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  stepBody: {
    gap: spacing.md,
    minHeight: 100,
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
    minHeight: 64,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  nextBtn: {
    flex: 1.4,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
