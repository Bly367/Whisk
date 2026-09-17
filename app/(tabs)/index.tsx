import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { GuestModeBanner } from '@/components/trust/GuestModeBanner';
import { radius, spacing } from '@/constants/tokens';
import { createOfflineReader, getDatabase, getRepositories } from '@/data';
import { useCookProgressStore } from '@/features/cook/cookProgressStore';
import { ensureSampleCookRecipe } from '@/features/cook/ensureSampleRecipe';
import { useSessionStore } from '@/features/trust/sessionStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const { colors } = useTheme();
  const mode = useSessionStore((s) => s.mode);
  const hydrateSession = useSessionStore((s) => s.hydrate);
  const hydrateCook = useCookProgressStore((s) => s.hydrate);
  const byRecipeId = useCookProgressStore((s) => s.byRecipeId);
  const [continueTitle, setContinueTitle] = useState<string | null>(null);
  const [continueId, setContinueId] = useState<string | null>(null);

  useEffect(() => {
    void hydrateSession();
    void hydrateCook();
  }, [hydrateSession, hydrateCook]);

  useEffect(() => {
    const entries = Object.values(byRecipeId);
    if (entries.length === 0) {
      setContinueId(null);
      setContinueTitle(null);
      return;
    }
    const latest = [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    try {
      const reader = createOfflineReader(getDatabase());
      const recipe = reader.getRecipe(latest.recipeId);
      if (recipe) {
        setContinueId(recipe.id);
        setContinueTitle(recipe.title);
      }
    } catch {
      // DB may not be ready on first paint in some environments.
    }
  }, [byRecipeId]);

  const openSampleCook = useCallback(() => {
    const db = getDatabase();
    const repos = getRepositories();
    const reader = createOfflineReader(db);
    const id = ensureSampleCookRecipe(repos, reader);
    router.push(`/recipe/${id}`);
  }, []);

  return (
    <Screen testID="screen-home">
      <GuestModeBanner mode={mode} />

      <PlaceholderHero
        title="Good to see you"
        body="Pick up where you left off — save a recipe, finish a plan, or open tonight’s list."
        actionLabel="Add a recipe"
        actionTestID="home-add-recipe"
        onAction={() => router.push('/add')}
      />

      {continueId && continueTitle ? (
        <View
          style={[styles.continue, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text variant="headline">Continue cooking</Text>
          <Text variant="body" tone="secondary">
            {continueTitle} — progress is saved if you leave.
          </Text>
          <Button
            label="Resume"
            testID="home-resume-cook"
            onPress={() => router.push(`/cook/${continueId}`)}
          />
        </View>
      ) : (
        <View
          style={[styles.continue, { backgroundColor: colors.sunken, borderColor: colors.border }]}
        >
          <Text variant="headline">Try cook mode</Text>
          <Text variant="body" tone="secondary">
            Large steps, screen stays awake, and your place is remembered after relaunch.
          </Text>
          <Button
            label="Open sample recipe"
            variant="secondary"
            testID="home-sample-cook"
            onPress={openSampleCook}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  continue: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
});
