import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ConfidenceBanner } from '@/components/import/ConfidenceBanner';
import { ConfidenceField } from '@/components/import/ConfidenceField';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { createId } from '@/data/util';
import { radius, spacing } from '@/constants/tokens';
import {
  commitImportDraft,
  ImportCommitError,
  parseIngredientLine,
  useImportSessionStore,
} from '@/import';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Editable import preview — required before any SQLite write.
 */
export default function ImportPreviewScreen() {
  const { colors } = useTheme();
  const draft = useImportSessionStore((s) => s.draft);
  const phase = useImportSessionStore((s) => s.phase);
  const savedDraftIds = useImportSessionStore((s) => s.savedDraftIds);
  const patchDraft = useImportSessionStore((s) => s.patchDraft);
  const setSaving = useImportSessionStore((s) => s.setSaving);
  const setSaved = useImportSessionStore((s) => s.setSaved);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const ingredientsText = useMemo(
    () =>
      (draft?.ingredients ?? [])
        .map((ing) => [ing.quantity, ing.unit, ing.name].filter(Boolean).join(' '))
        .join('\n'),
    [draft?.ingredients],
  );

  const instructionsText = useMemo(
    () => (draft?.instructions ?? []).map((step) => step.text).join('\n'),
    [draft?.instructions],
  );

  if (!draft) {
    return (
      <Screen testID="screen-import-preview-empty" showSyncStatus={false}>
        <Text variant="title2">Nothing to review</Text>
        <Text variant="body" tone="secondary">
          Start from Add and import a link, share, or paste text first. Whisk never saves without
          this preview.
        </Text>
        <Button
          label="Back to Add"
          onPress={() => router.replace('/(tabs)/add')}
          testID="preview-back-add"
        />
      </Screen>
    );
  }

  const applyIngredients = (text: string) => {
    const ingredients = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => parseIngredientLine(line, index));
    patchDraft({ ingredients });
  };

  const applyInstructions = (text: string) => {
    const instructions = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((textLine, index) => ({
        id: createId(),
        text: textLine,
        position: index,
      }));
    patchDraft({ instructions });
  };

  const handleSave = () => {
    setSaveError(null);
    setSavedNote(null);
    setSaving();
    try {
      const recipe = commitImportDraft(draft, {
        alreadySavedDraftIds: savedDraftIds,
      });
      setSaved(recipe.id, draft.id);
      setSavedNote('Saved locally. You can find it in Recipes.');
    } catch (error) {
      const message =
        error instanceof ImportCommitError ? error.message : 'Could not save. Nothing was stored.';
      setSaveError(message);
      // Keep draft in preview — never clear on validation failure.
      useImportSessionStore.setState({ phase: 'preview' });
    }
  };

  return (
    <Screen testID="screen-import-preview" showSyncStatus>
      <Text variant="body" tone="secondary">
        Check everything below. Low-confidence fields are marked for review. Nothing is saved until
        you confirm.
      </Text>

      {draft.warnings.length > 0 ? (
        <View style={styles.warnings} testID="preview-warnings">
          {draft.warnings.map((warning, index) => (
            <ConfidenceBanner
              key={`${warning.code}-${index}`}
              level={warning.field ? (draft.confidence[warning.field] ?? 'low') : 'low'}
              message={warning.message}
            />
          ))}
        </View>
      ) : null}

      {draft.sourceUrl ? (
        <View
          style={[
            styles.sourceCard,
            { backgroundColor: colors.sunken, borderColor: colors.border },
          ]}
          testID="preview-source"
        >
          <Text variant="caption" tone="secondary">
            Original source (kept for comparison)
          </Text>
          <Text variant="callout">{draft.sourceUrl}</Text>
          {draft.sourceEvidence ? (
            <Text variant="caption" tone="secondary" numberOfLines={4}>
              Evidence snippet: {draft.sourceEvidence.slice(0, 240)}
            </Text>
          ) : null}
        </View>
      ) : null}

      <ConfidenceField
        label="Title"
        value={draft.title}
        onChangeText={(title) => patchDraft({ title })}
        confidence={draft.confidence.title}
        reviewHint="Title looked uncertain — confirm it matches the source."
        testID="preview-title"
      />

      <ConfidenceField
        label="Servings"
        value={draft.servings != null ? String(draft.servings) : ''}
        onChangeText={(value) => {
          const parsed = value.trim() ? Number(value) : null;
          patchDraft({
            servings: parsed != null && !Number.isNaN(parsed) ? parsed : null,
          });
        }}
        keyboardType="number-pad"
        confidence={draft.confidence.servings}
        reviewHint="Servings may be missing or guessed — adjust if needed."
        testID="preview-servings"
      />

      <View style={styles.field}>
        <Text variant="headline">Ingredients</Text>
        <TextInput
          value={ingredientsText}
          onChangeText={applyIngredients}
          multiline
          placeholder="One ingredient per line"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.multi,
            {
              backgroundColor: colors.card,
              borderColor: draft.confidence.ingredients === 'high' ? colors.border : colors.warning,
              color: colors.textPrimary,
            },
          ]}
          testID="preview-ingredients"
          accessibilityLabel="Ingredients"
          accessibilityHint="Edit extracted ingredients before saving"
        />
        <ConfidenceBanner
          level={draft.confidence.ingredients}
          message="Ingredient list may be incomplete — compare with the source."
        />
      </View>

      <View style={styles.field}>
        <Text variant="headline">Steps</Text>
        <TextInput
          value={instructionsText}
          onChangeText={applyInstructions}
          multiline
          placeholder="One step per line"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.multi,
            {
              backgroundColor: colors.card,
              borderColor:
                draft.confidence.instructions === 'high' ? colors.border : colors.warning,
              color: colors.textPrimary,
            },
          ]}
          testID="preview-instructions"
          accessibilityLabel="Cooking steps"
        />
        <ConfidenceBanner
          level={draft.confidence.instructions}
          message="Steps may be incomplete — compare with the source."
        />
      </View>

      <ConfidenceField
        label="Notes"
        value={draft.notes ?? ''}
        onChangeText={(notes) => patchDraft({ notes: notes || null })}
        multiline
        confidence={draft.confidence.notes}
        reviewHint="Notes came from page description — edit freely."
        style={styles.multi}
        testID="preview-notes"
      />

      {saveError ? (
        <Text variant="body" tone="error" testID="preview-save-error">
          {saveError}
        </Text>
      ) : null}

      {savedNote || phase === 'saved' ? (
        <View
          style={[
            styles.success,
            {
              backgroundColor: colors.brand.yolkSoft,
              borderColor: colors.success,
            },
          ]}
          testID="preview-saved"
        >
          <Text variant="headline" tone="success">
            Saved locally
          </Text>
          <Text variant="body" tone="secondary">
            {savedNote ?? 'Recipe is on this device. Sync can follow later.'}
          </Text>
          <Button
            label="Done"
            onPress={() => router.replace('/(tabs)/recipes')}
            testID="preview-done"
          />
        </View>
      ) : (
        <Button
          label="Save recipe"
          onPress={handleSave}
          loading={phase === 'saving'}
          testID="preview-save"
          accessibilityHint="Saves to this device after your review"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  warnings: {
    gap: spacing.sm,
  },
  sourceCard: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  field: {
    gap: spacing.sm,
  },
  multi: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 17,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  success: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
