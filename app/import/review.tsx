import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useRecipeStore } from '../../store/recipeStore';
import { Ingredient } from '../../types/recipe';

export default function ImportReviewScreen() {
  const draft = useRecipeStore((state) => state.currentImport?.draft);
  const updateDraft = useRecipeStore((state) => state.updateDraft);
  const saveDraft = useRecipeStore((state) => state.saveDraft);
  const clearImport = useRecipeStore((state) => state.clearImport);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [servings, setServings] = useState(String(draft?.servings ?? 1));
  const [ingredients, setIngredients] = useState(
    draft?.ingredients.map(formatIngredient).join('\n') ?? '',
  );
  const [steps, setSteps] = useState(draft?.steps.join('\n') ?? '');

  const canSave = title.trim() && ingredients.trim() && steps.trim();
  const parsedIngredients = useMemo(
    () =>
      ingredients
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseIngredientLine),
    [ingredients],
  );

  if (!draft) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No recipe draft to review</Text>
          <Pressable onPress={() => router.replace('/import/url')} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Import a recipe</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const buildDraft = () => ({
    ...draft,
    title: title.trim(),
    description: description.trim() || undefined,
    servings: Math.max(1, Number(servings) || 1),
    ingredients: parsedIngredients,
    steps: steps
      .split('\n')
      .map((step) => step.trim())
      .filter(Boolean),
  });

  const handleSave = () => {
    if (!canSave) return;
    const id = saveDraft(buildDraft());
    router.replace(`/recipe/${id}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Review recipe"
        subtitle="Check the highlighted details before saving."
        onBack={() => {
          updateDraft(buildDraft());
          router.back();
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {draft.warnings.length ? (
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={20} color={colors.accentAlt} />
            <View style={styles.warningCopy}>
              {draft.warnings.map((warning, index) => (
                <Text key={`${warning.code}-${index}`} style={styles.warningText}>
                  {warning.message}
                </Text>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.readyCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.readyText}>Structured recipe found. Give it a quick check.</Text>
          </View>
        )}

        <Field label="Recipe name" value={title} onChangeText={setTitle} />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Field
          label="Servings"
          value={servings}
          onChangeText={setServings}
          keyboardType="number-pad"
        />
        <Field
          label="Ingredients (one per line)"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          important={!ingredients.trim()}
        />
        <Field
          label="Steps (one per line)"
          value={steps}
          onChangeText={setSteps}
          multiline
          important={!steps.trim()}
        />

        {draft.sourceUrl ? (
          <Pressable onPress={() => Linking.openURL(draft.sourceUrl!)} style={styles.sourceButton}>
            <Ionicons name="open-outline" size={17} color={colors.accent} />
            <Text style={styles.sourceText} numberOfLines={1}>
              View original source
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.primaryButton, !canSave && styles.disabled]}
        >
          <Text style={styles.primaryText}>Save to Library</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            clearImport();
            router.replace('/(tabs)/import');
          }}
        >
          <Text style={styles.cancelText}>Discard draft</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  important,
  multiline,
  ...props
}: {
  label: string;
  important?: boolean;
  multiline?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, important && styles.labelImportant]}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.inputMulti, important && styles.inputImportant]}
      />
    </View>
  );
}

function formatIngredient(ingredient: Ingredient) {
  return [ingredient.amount, ingredient.unit, ingredient.name].filter(Boolean).join(' ');
}

function parseIngredientLine(line: string, index: number): Ingredient {
  const match = line.match(/^(\d+(?:\.\d+)?|\d+\/\d+)?\s*([a-zA-Z]+)?\s*(.*)$/);
  if (!match) return { id: `review-${index}`, amount: '', unit: '', name: line };
  const [, amount = '', possibleUnit = '', remainder = ''] = match;
  const knownUnit = /^(tsp|tbsp|cup|cups|oz|lb|g|kg|ml|l|clove|cloves)$/i.test(possibleUnit);
  return {
    id: `review-${index}`,
    amount,
    unit: knownUnit ? possibleUnit : '',
    name: knownUnit ? remainder : `${possibleUnit} ${remainder}`.trim(),
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  empty: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  emptyTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  warningCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 71, 0.35)',
    backgroundColor: 'rgba(255, 179, 71, 0.08)',
  },
  warningCopy: { flex: 1, gap: spacing.xs },
  warningText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  readyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(95, 214, 138, 0.08)',
  },
  readyText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  field: { gap: spacing.sm },
  label: { ...typography.label, color: colors.textMuted },
  labelImportant: { color: colors.accentAlt },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMulti: { minHeight: 120, textAlignVertical: 'top' },
  inputImportant: { borderColor: colors.accentAlt },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  sourceText: { ...typography.caption, color: colors.accent, flex: 1 },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  primaryText: { ...typography.subtitle, color: '#fff' },
  disabled: { opacity: 0.45 },
  cancelText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
