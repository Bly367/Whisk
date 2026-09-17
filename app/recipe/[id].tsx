import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { createOfflineReader, getDatabase } from '@/data';
import type { RecipeWithIngredients } from '@/data/contracts';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Minimal recipe detail entry for cook mode (W7).
 * Full edit/library UX belongs to W3 — this only unlocks Start cooking + view.
 */
export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoaded(true);
      return;
    }
    const reader = createOfflineReader(getDatabase());
    setRecipe(reader.getRecipe(id));
    setLoaded(true);
  }, [id]);

  if (!loaded) {
    return (
      <Screen testID="recipe-loading">
        <Text tone="secondary">Loading recipe…</Text>
      </Screen>
    );
  }

  if (!recipe) {
    return (
      <Screen testID="recipe-missing">
        <Stack.Screen options={{ title: 'Recipe' }} />
        <Text variant="title2">Recipe not found</Text>
        <Text variant="body" tone="secondary">
          It may be in trash or was removed. Export and other recipes still work.
        </Text>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen testID="screen-recipe-detail">
      <Stack.Screen
        options={{
          title: recipe.title,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />

      <Text variant="title1">{recipe.title}</Text>
      {recipe.sourceName || recipe.sourceUrl ? (
        <Text variant="caption" tone="secondary">
          Source: {recipe.sourceName ?? recipe.sourceUrl}
        </Text>
      ) : null}

      <View style={styles.meta}>
        {recipe.servings != null ? (
          <Text variant="callout" tone="secondary">
            {recipe.servings} servings
          </Text>
        ) : null}
        {recipe.cookMinutes != null || recipe.prepMinutes != null ? (
          <Text variant="callout" tone="secondary">
            {[
              recipe.prepMinutes != null ? `${recipe.prepMinutes} min prep` : null,
              recipe.cookMinutes != null ? `${recipe.cookMinutes} min cook` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>

      <Button
        label="Start cooking"
        testID="recipe-start-cooking"
        onPress={() => router.push(`/cook/${recipe.id}`)}
      />

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text variant="headline">Ingredients</Text>
        {recipe.ingredients.length === 0 ? (
          <Text tone="secondary">No ingredients yet.</Text>
        ) : (
          recipe.ingredients.map((ing) => (
            <Text key={ing.id} variant="body">
              {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
            </Text>
          ))
        )}
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text variant="headline">Steps</Text>
        {recipe.instructions.length === 0 ? (
          <Text tone="secondary">No steps yet.</Text>
        ) : (
          recipe.instructions.map((step, index) => (
            <Text key={step.id} variant="body">
              {index + 1}. {step.text}
            </Text>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
