import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PlaceholderHero } from '@/components/ui/PlaceholderHero';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { createId, nowIso } from '@/data/util';
import { radius, spacing } from '@/constants/tokens';
import { parseIngredientLine, useImportSessionStore, type ImportDraft } from '@/import';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Manual create fallback — builds a draft and routes through preview before save.
 * Full library CRUD remains W3; this path only prevents dead-end import failures.
 */
export default function ImportManualScreen() {
  const { colors } = useTheme();
  const setPreview = useImportSessionStore((s) => s.setPreview);
  const [title, setTitle] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Add a title to continue.');
      return;
    }
    const ingredients = ingredientsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => parseIngredientLine(line, index));
    const instructions = stepsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text, index) => ({
        id: createId(),
        text,
        position: index,
      }));

    if (!ingredients.length && !instructions.length) {
      setError('Add at least one ingredient or step before continuing.');
      return;
    }

    const draft: ImportDraft = {
      id: createId(),
      sourceKind: 'manual',
      sourceUrl: null,
      sourceName: null,
      imageUri: null,
      title: trimmedTitle,
      notes: null,
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      ingredients,
      instructions,
      confidence: {
        title: 'high',
        ingredients: ingredients.length ? 'high' : 'unknown',
        instructions: instructions.length ? 'high' : 'unknown',
      },
      warnings: [],
      sourceEvidence: null,
      adapterId: 'manual',
      createdAt: nowIso(),
    };

    setPreview(draft);
    router.push('/import/preview');
  };

  return (
    <Screen testID="screen-import-manual" showSyncStatus={false}>
      <PlaceholderHero
        title="Create manually"
        body="Type the recipe yourself. You’ll still confirm on the preview screen before it’s saved."
      />

      <View style={styles.field}>
        <Text variant="headline">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Recipe title"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          testID="manual-title"
          accessibilityLabel="Recipe title"
        />
      </View>

      <View style={styles.field}>
        <Text variant="headline">Ingredients</Text>
        <TextInput
          value={ingredientsText}
          onChangeText={setIngredientsText}
          placeholder="One per line"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[
            styles.multi,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          testID="manual-ingredients"
          accessibilityLabel="Ingredients"
        />
      </View>

      <View style={styles.field}>
        <Text variant="headline">Steps</Text>
        <TextInput
          value={stepsText}
          onChangeText={setStepsText}
          placeholder="One per line"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[
            styles.multi,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          testID="manual-steps"
          accessibilityLabel="Steps"
        />
      </View>

      {error ? (
        <Text variant="body" tone="error" testID="manual-error">
          {error}
        </Text>
      ) : null}

      <Button label="Review before saving" onPress={handleContinue} testID="manual-continue" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 17,
  },
  multi: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 17,
    textAlignVertical: 'top',
  },
});
