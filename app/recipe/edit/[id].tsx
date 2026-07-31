import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import { useRecipeStore } from '../../../store/recipeStore';
import { Ingredient } from '../../../types/recipe';

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipeStore((state) => state.recipes.find((item) => item.id === id));
  const updateRecipe = useRecipeStore((state) => state.updateRecipe);
  const syncToCloud = useRecipeStore((state) => state.syncToCloud);
  const user = useAuthStore((state) => state.user);

  const [title, setTitle] = useState(recipe?.title ?? '');
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [servings, setServings] = useState(String(recipe?.servings ?? 2));
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients.map(formatIngredient).join('\n') ?? '',
  );
  const [steps, setSteps] = useState(recipe?.steps.join('\n') ?? '');

  const parsedIngredients = useMemo(
    () =>
      ingredients
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseIngredientLine),
    [ingredients],
  );

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Recipe not found</Text>
      </SafeAreaView>
    );
  }

  const canSave = title.trim() && ingredients.trim() && steps.trim();

  const handleSave = () => {
    if (!canSave) return;
    updateRecipe(recipe.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      servings: Math.max(1, Number(servings) || 1),
      ingredients: parsedIngredients,
      steps: steps
        .split('\n')
        .map((step) => step.trim())
        .filter(Boolean),
    });
    if (user) void syncToCloud(user.id);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Edit recipe" subtitle="Update ingredients, steps, and details." onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Recipe name" value={title} onChangeText={setTitle} />
          <Field label="Description" value={description} onChangeText={setDescription} multiline />
          <Field label="Servings" value={servings} onChangeText={setServings} keyboardType="number-pad" />
          <Field
            label="Ingredients (one per line)"
            value={ingredients}
            onChangeText={setIngredients}
            multiline
          />
          <Field label="Steps (one per line)" value={steps} onChangeText={setSteps} multiline />
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          >
            <Text style={styles.saveText}>Save Changes</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  multiline,
  ...props
}: {
  label: string;
  multiline?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.inputMulti]}
      />
    </View>
  );
}

function formatIngredient(ingredient: Ingredient) {
  return [ingredient.amount, ingredient.unit, ingredient.name].filter(Boolean).join(' ');
}

function parseIngredientLine(line: string, index: number): Ingredient {
  const match = line.match(/^(\d+(?:\.\d+)?|\d+\/\d+)?\s*([a-zA-Z]+)?\s*(.*)$/);
  if (!match) return { id: `edit-${index}`, amount: '', unit: '', name: line };
  const [, amount = '', possibleUnit = '', remainder = ''] = match;
  const knownUnit = /^(tsp|tbsp|cup|cups|oz|lb|g|kg|ml|l|clove|cloves)$/i.test(possibleUnit);
  return {
    id: `edit-${index}`,
    amount,
    unit: knownUnit ? possibleUnit : '',
    name: knownUnit ? remainder : `${possibleUnit} ${remainder}`.trim(),
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  missing: { color: colors.text, textAlign: 'center', marginTop: spacing.xl },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  field: { gap: spacing.sm },
  label: { ...typography.label, color: colors.textMuted },
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
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { ...typography.subtitle, color: '#fff' },
});
