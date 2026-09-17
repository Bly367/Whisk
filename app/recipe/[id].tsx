import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IngredientLine, ServingStepper } from '@/components/recipes/ServingControls';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import { getRepositories } from '@/data';
import type { UnitSystem } from '@/features/recipes/scale';
import { isUnitSystemAvailable } from '@/features/recipes/scale';
import { useUnitPreferenceStore } from '@/features/recipes/unitPreferenceStore';
import { useTheme } from '@/theme/ThemeProvider';

const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'original', label: 'As written' },
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
];

const UNIT_UNAVAILABLE_HINT =
  'Unit conversion coming later — amounts stay as written so they stay accurate.';

export default function RecipeDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useMemo(() => (id ? getRepositories().recipes.getById(id) : null), [id]);
  const tags = useMemo(() => getRepositories().tags.list(), []);
  const system = useUnitPreferenceStore((s) => s.system);
  const setSystem = useUnitPreferenceStore((s) => s.setSystem);

  const baseServings = recipe?.servings && recipe.servings > 0 ? recipe.servings : 1;
  const [servings, setServings] = useState(baseServings);

  if (!recipe) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.canvas }]} testID="recipe-missing">
        <Text variant="title2">Recipe not found</Text>
        <Button label="Back to library" onPress={() => router.replace('/recipes')} />
      </View>
    );
  }

  const tagNames = recipe.tagIds
    .map((tagId) => tags.find((t) => t.id === tagId)?.name)
    .filter((n): n is string => !!n);
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || null;

  return (
    <>
      <Stack.Screen
        options={{
          title: recipe.title,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/recipe/edit/${recipe.id}`)}
              accessibilityRole="button"
              accessibilityLabel="Edit recipe"
              testID="recipe-edit-link"
              style={{ paddingHorizontal: spacing.md, minHeight: 44, justifyContent: 'center' }}
            >
              <Text variant="callout" tone="info">
                Edit
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        testID="screen-recipe-detail"
        contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]}
        style={{ flex: 1, backgroundColor: colors.canvas }}
      >
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.brand.yolkSoft, borderColor: colors.border },
          ]}
          accessible={false}
        />
        <Text variant="title1">{recipe.title}</Text>
        {recipe.status === 'draft' ? (
          <Text variant="caption" tone="warning">
            Draft — still saving locally
          </Text>
        ) : null}
        <View style={styles.meta}>
          {total != null ? (
            <Text variant="caption" tone="secondary">
              {total} min
            </Text>
          ) : null}
          {recipe.rating != null ? (
            <Text variant="caption" tone="secondary">
              ★ {recipe.rating.toFixed(1)}
            </Text>
          ) : null}
          {recipe.sourceUrl || recipe.sourceName ? (
            <Text variant="caption" tone="info" numberOfLines={1}>
              {recipe.sourceName || recipe.sourceUrl}
            </Text>
          ) : null}
        </View>
        {tagNames.length ? (
          <Text variant="caption" tone="secondary">
            {tagNames.join(' · ')}
          </Text>
        ) : null}

        <Button
          label="Start cooking"
          onPress={() => router.push(`/cook/${recipe.id}`)}
          accessibilityHint="Open cook mode with large steps"
          testID="start-cooking"
        />

        <ServingStepper servings={servings} onChange={setServings} baseServings={recipe.servings} />

        <View style={styles.unitBlock}>
          <Text variant="callout">Units</Text>
          <ChipRow>
            {UNIT_OPTIONS.map((option) => {
              const available = isUnitSystemAvailable(option.value);
              return (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={system === option.value}
                  disabled={!available}
                  onPress={available ? () => setSystem(option.value) : undefined}
                  accessibilityHint={available ? undefined : UNIT_UNAVAILABLE_HINT}
                  testID={`unit-${option.value}`}
                />
              );
            })}
          </ChipRow>
          <Text variant="caption" tone="secondary">
            Metric and Imperial conversion isn’t ready yet. Amounts stay as written.
          </Text>
        </View>

        <Text variant="title2">Ingredients</Text>
        <View testID="ingredient-list">
          {recipe.ingredients.map((ing) => (
            <IngredientLine
              key={ing.id}
              name={ing.name}
              quantity={ing.quantity}
              unit={ing.unit}
              note={ing.note}
              baseServings={recipe.servings}
              targetServings={servings}
              testID={`ingredient-${ing.id}`}
            />
          ))}
        </View>

        <Text variant="title2">Steps</Text>
        {recipe.instructions
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((step, index) => (
            <View key={step.id} style={[styles.step, { borderColor: colors.border }]}>
              <Text variant="callout">Step {index + 1}</Text>
              <Text variant="body">{step.text}</Text>
            </View>
          ))}

        {recipe.notes ? (
          <>
            <Text variant="title2">Notes</Text>
            <Text variant="body" tone="secondary">
              {recipe.notes}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    height: 160,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  unitBlock: {
    gap: spacing.sm,
  },
  step: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  missing: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    justifyContent: 'center',
  },
});
