import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Text } from '@/components/ui/Text';
import { SyncStatusBanner } from '@/components/ui/SyncStatusBanner';
import { spacing } from '@/constants/tokens';
import { getRepositories } from '@/data';
import { useSyncStatusStore } from '@/data/sync/statusStore';
import { useRecipeEditor } from '@/features/recipes/useRecipeEditor';
import { useTheme } from '@/theme/ThemeProvider';

export default function RecipeEditScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const initialId = params.id && params.id !== 'new' ? params.id : null;
  const editor = useRecipeEditor(initialId);
  const syncStatus = useSyncStatusStore((s) => s.status);
  const collections = useMemo(() => getRepositories().collections.list(), []);

  const onPublish = async () => {
    const recipe = await editor.publish();
    if (recipe) {
      router.replace(`/recipe/${recipe.id}`);
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Move to trash?',
      'You can restore this recipe later from trash.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to trash',
          style: 'destructive',
          onPress: () => {
            editor.softDelete();
            router.replace('/recipes');
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: initialId ? 'Edit recipe' : 'New recipe',
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        testID="screen-recipe-edit"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]}
        style={{ backgroundColor: colors.canvas, flex: 1 }}
      >
        <SyncStatusBanner status={syncStatus} />
        <Text variant="caption" tone="secondary" testID="autosave-hint">
          {editor.saving
            ? 'Saving…'
            : editor.lastSavedAt
              ? 'Saved on this device'
              : 'Edits save automatically'}
        </Text>
        {editor.error ? (
          <Text variant="caption" tone="error">
            {editor.error}
          </Text>
        ) : null}

        <Field
          label="Title"
          value={editor.draft.title}
          onChangeText={(text) => editor.updateField('title', text)}
          placeholder="e.g. Lemon pasta"
          testID="edit-title"
        />
        <Field
          label="Servings"
          value={editor.draft.servings}
          onChangeText={(text) => editor.updateField('servings', text)}
          keyboardType="numeric"
          placeholder="4"
          testID="edit-servings"
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <Field
              label="Prep (min)"
              value={editor.draft.prepMinutes}
              onChangeText={(text) => editor.updateField('prepMinutes', text)}
              keyboardType="numeric"
              testID="edit-prep"
            />
          </View>
          <View style={styles.half}>
            <Field
              label="Cook (min)"
              value={editor.draft.cookMinutes}
              onChangeText={(text) => editor.updateField('cookMinutes', text)}
              keyboardType="numeric"
              testID="edit-cook"
            />
          </View>
        </View>
        <Field
          label="Ingredients"
          value={editor.draft.ingredientsText}
          onChangeText={(text) => editor.updateField('ingredientsText', text)}
          multiline
          placeholder={'2 cups flour\n1 tsp salt'}
          testID="edit-ingredients"
        />
        <Field
          label="Steps"
          value={editor.draft.instructionsText}
          onChangeText={(text) => editor.updateField('instructionsText', text)}
          multiline
          placeholder={'Mix dry ingredients\nBake until golden'}
          testID="edit-instructions"
        />
        <Field
          label="Tags"
          value={editor.draft.tagNames}
          onChangeText={(text) => editor.updateField('tagNames', text)}
          placeholder="Weeknight, Pasta"
          testID="edit-tags"
        />
        <Field
          label="Notes"
          value={editor.draft.notes}
          onChangeText={(text) => editor.updateField('notes', text)}
          multiline
          testID="edit-notes"
        />
        <Field
          label="Source URL"
          value={editor.draft.sourceUrl}
          onChangeText={(text) => editor.updateField('sourceUrl', text)}
          keyboardType="url"
          autoCapitalize="none"
          testID="edit-source"
        />

        {collections.length ? (
          <View style={styles.collections}>
            <Text variant="callout">Collections</Text>
            <ChipRow>
              {collections.map((collection) => {
                const selected = editor.draft.collectionIds.includes(collection.id);
                return (
                  <Chip
                    key={collection.id}
                    label={collection.name}
                    selected={selected}
                    onPress={() => {
                      const next = selected
                        ? editor.draft.collectionIds.filter((id) => id !== collection.id)
                        : [...editor.draft.collectionIds, collection.id];
                      editor.updateField('collectionIds', next);
                    }}
                    testID={`edit-collection-${collection.id}`}
                  />
                );
              })}
            </ChipRow>
          </View>
        ) : null}

        <Button
          label="Save recipe"
          onPress={() => void onPublish()}
          testID="edit-publish"
        />
        {editor.recipeId ? (
          <Button
            label="Move to trash"
            variant="destructive"
            onPress={onDelete}
            testID="edit-delete"
          />
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  collections: {
    gap: spacing.sm,
  },
});
