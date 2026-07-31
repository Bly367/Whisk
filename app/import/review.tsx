import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { persistRecipeImage } from '../../services/media/recipeImages';
import { useAuthStore } from '../../store/authStore';
import { useRecipeStore } from '../../store/recipeStore';
import { Ingredient } from '../../types/recipe';

export default function ImportReviewScreen() {
  const draft = useRecipeStore((state) => state.currentImport?.draft);
  const updateDraft = useRecipeStore((state) => state.updateDraft);
  const saveDraft = useRecipeStore((state) => state.saveDraft);
  const updateRecipe = useRecipeStore((state) => state.updateRecipe);
  const syncToCloud = useRecipeStore((state) => state.syncToCloud);
  const clearImport = useRecipeStore((state) => state.clearImport);
  const user = useAuthStore((state) => state.user);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [servings, setServings] = useState(String(draft?.servings ?? 1));
  const [ingredients, setIngredients] = useState(
    draft?.ingredients.map(formatIngredient).join('\n') ?? '',
  );
  const [steps, setSteps] = useState(draft?.steps.join('\n') ?? '');
  const [savedRecipeId, setSavedRecipeId] = useState<string>();
  const [savedStoragePath, setSavedStoragePath] = useState<string>();
  const [imageStatus, setImageStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [imageError, setImageError] = useState<string>();
  const [imageProgress, setImageProgress] = useState('Preparing image…');

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

  const finish = (id: string) => {
    clearImport();
    router.replace(`/recipe/${id}`);
  };

  const handleSave = async () => {
    if (!canSave || imageStatus === 'saving') return;
    const id = savedRecipeId ?? saveDraft(buildDraft());
    if (!savedRecipeId) setSavedRecipeId(id);

    const existingStoragePath = savedStoragePath ?? draft.imageStoragePath;
    if (!draft.imageUrl || existingStoragePath) {
      if (existingStoragePath && !draft.imageStoragePath) {
        updateRecipe(id, { imageStoragePath: existingStoragePath });
      }
      if (user && !(await syncToCloud(user.id))) {
        setImageStatus('error');
        setImageError('The recipe is saved on this device, but cloud sync is not available yet.');
        return;
      }
      finish(id);
      return;
    }

    if (!user) {
      setImageStatus('error');
      setImageError(
        'The recipe and its original image are saved on this device. Sign in to back up the image to the cloud.',
      );
      return;
    }

    setImageStatus('saving');
    setImageError(undefined);
    setImageProgress('Preparing image…');
    try {
      const storagePath = await persistRecipeImage(draft.imageUrl, user.id, id, {
        onProgress: (progress) => {
          if (progress.stage === 'copying') {
            setImageProgress('Copying image securely…');
          } else if (progress.stage === 'reading') {
            setImageProgress('Preparing image…');
          } else if (progress.stage === 'uploading') {
            setImageProgress(
              progress.totalBytes > 0
                ? `Uploading image… ${Math.round(progress.fraction * 100)}%`
                : 'Uploading image…',
            );
          }
        },
      });
      setSavedStoragePath(storagePath);
      updateRecipe(id, { imageStoragePath: storagePath });
      if (!(await syncToCloud(user.id))) {
        setImageStatus('error');
        setImageError(
          'The image is backed up, but the updated recipe has not synced yet. Retry to finish.',
        );
        return;
      }
      finish(id);
    } catch (error) {
      setImageStatus('error');
      setImageError(
        error instanceof Error
          ? `${error.message} The original image is still attached, but it is not cloud-backed yet.`
          : 'The original image is still attached, but it is not cloud-backed yet.',
      );
    }
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

        {imageStatus !== 'idle' ? (
          <View style={[styles.mediaStatus, imageStatus === 'error' && styles.mediaStatusError]}>
            {imageStatus === 'saving' ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Ionicons name="cloud-offline-outline" size={20} color={colors.accentAlt} />
            )}
            <Text style={styles.mediaStatusText}>
              {imageStatus === 'saving'
                ? `Recipe saved. ${imageProgress}`
                : imageError}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => void handleSave()}
          disabled={!canSave || imageStatus === 'saving'}
          style={[
            styles.primaryButton,
            (!canSave || imageStatus === 'saving') && styles.disabled,
          ]}
        >
          <Text style={styles.primaryText}>
            {imageStatus === 'error' ? 'Retry cloud backup' : 'Save to Library'}
          </Text>
        </Pressable>
        {savedRecipeId && imageStatus === 'error' ? (
          <Pressable
            onPress={() => finish(savedRecipeId)}
            style={styles.continueButton}
          >
            <Text style={styles.continueText}>Continue with original image</Text>
          </Pressable>
        ) : null}
        {!savedRecipeId ? (
          <Pressable
            onPress={() => {
              clearImport();
              router.replace('/(tabs)/import');
            }}
          >
            <Text style={styles.cancelText}>Discard draft</Text>
          </Pressable>
        ) : null}
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
  mediaStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(94, 169, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(94, 169, 255, 0.2)',
  },
  mediaStatusError: {
    backgroundColor: 'rgba(255, 179, 71, 0.08)',
    borderColor: 'rgba(255, 179, 71, 0.3)',
  },
  mediaStatusText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  primaryText: { ...typography.subtitle, color: '#fff' },
  disabled: { opacity: 0.45 },
  continueButton: { alignItems: 'center', paddingVertical: spacing.sm },
  continueText: { ...typography.caption, color: colors.accent },
  cancelText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
