import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { RecipeImage } from '../../../components/RecipeImage';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import {
  persistRecipeImage,
  removeRecipeImage,
} from '../../../services/media/recipeImages';
import { useAuthStore } from '../../../store/authStore';
import { useRecipeStore } from '../../../store/recipeStore';
import { Ingredient } from '../../../types/recipe';

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipeStore((state) => state.recipes.find((item) => item.id === id));
  const updateRecipe = useRecipeStore((state) => state.updateRecipe);
  const user = useAuthStore((state) => state.user);

  const [title, setTitle] = useState(recipe?.title ?? '');
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [servings, setServings] = useState(String(recipe?.servings ?? 2));
  const [prepTime, setPrepTime] = useState(String(recipe?.prepTime ?? ''));
  const [cookTime, setCookTime] = useState(String(recipe?.cookTime ?? ''));
  const [tags, setTags] = useState(recipe?.tags.join(', ') ?? '');
  const [imageUrl, setImageUrl] = useState(recipe?.imageUrl ?? '');
  const [calories, setCalories] = useState(String(recipe?.nutrition?.calories ?? ''));
  const [protein, setProtein] = useState(String(recipe?.nutrition?.protein ?? ''));
  const [carbs, setCarbs] = useState(String(recipe?.nutrition?.carbs ?? ''));
  const [fat, setFat] = useState(String(recipe?.nutrition?.fat ?? ''));
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients.map(formatIngredient).join('\n') ?? '',
  );
  const [steps, setSteps] = useState(recipe?.steps.join('\n') ?? '');
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState('Saving…');

  const parsedIngredients = useMemo(
    () =>
      ingredients
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) =>
          parseIngredientLine(line, index, recipe?.ingredients[index]?.id),
        ),
    [ingredients, recipe?.ingredients],
  );

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Recipe not found</Text>
      </SafeAreaView>
    );
  }

  const canSave = Boolean(title.trim() && ingredients.trim() && steps.trim());

  const chooseImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to update the recipe image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) setImageUrl(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSavingLabel('Saving…');
    try {
      const hasNutrition = [calories, protein, carbs, fat].some((value) => value.trim());
      const imageChanged = imageUrl.trim() !== (recipe.imageUrl ?? '');
      let imageStoragePath = recipe.imageStoragePath;

      if (imageChanged) {
        if (imageUrl.trim() && user) {
          const nextPath = await persistRecipeImage(imageUrl.trim(), user.id, recipe.id, {
            onProgress: (progress) => {
              if (progress.stage === 'copying') {
                setSavingLabel('Copying image…');
              } else if (progress.stage === 'reading') {
                setSavingLabel('Preparing image…');
              } else if (progress.stage === 'uploading') {
                setSavingLabel(
                  progress.totalBytes > 0
                    ? `Uploading ${Math.round(progress.fraction * 100)}%`
                    : 'Uploading image…',
                );
              }
            },
          });
          if (recipe.imageStoragePath) {
            await removeRecipeImage(recipe.imageStoragePath, user.id).catch(() => undefined);
          }
          imageStoragePath = nextPath;
        } else {
          if (user && recipe.imageStoragePath) {
            setSavingLabel('Removing old image…');
            await removeRecipeImage(recipe.imageStoragePath, user.id).catch(() => undefined);
          }
          imageStoragePath = undefined;
        }
      }

      updateRecipe(recipe.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        imageStoragePath,
        servings: Math.max(1, Number(servings) || 1),
        prepTime: prepTime.trim() ? Math.max(0, Number(prepTime) || 0) : undefined,
        cookTime: cookTime.trim() ? Math.max(0, Number(cookTime) || 0) : undefined,
        tags: tags
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        nutrition: hasNutrition
          ? {
              calories: Math.max(0, Number(calories) || 0),
              protein: Math.max(0, Number(protein) || 0),
              carbs: Math.max(0, Number(carbs) || 0),
              fat: Math.max(0, Number(fat) || 0),
            }
          : undefined,
        ingredients: parsedIngredients,
        steps: steps
          .split('\n')
          .map((step) => step.trim())
          .filter(Boolean),
      });
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not save image',
        error instanceof Error ? error.message : 'Try another image and save again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          title="Edit recipe"
          subtitle="Update every detail of your saved recipe."
          onBack={() => router.back()}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <RecipeImage
            imageUrl={imageUrl || undefined}
            imageStoragePath={
              imageUrl === (recipe.imageUrl ?? '') ? recipe.imageStoragePath : undefined
            }
            gradient={recipe.imageGradient}
            style={styles.image}
          />
          <Pressable onPress={() => void chooseImage()} style={styles.imageButton}>
            <Text style={styles.imageButtonText}>Choose image</Text>
          </Pressable>
          <Field label="Image URL" value={imageUrl} onChangeText={setImageUrl} />
          <Field label="Recipe name" value={title} onChangeText={setTitle} />
          <Field label="Description" value={description} onChangeText={setDescription} multiline />

          <View style={styles.fieldGrid}>
            <Field label="Servings" value={servings} onChangeText={setServings} keyboardType="number-pad" compact />
            <Field label="Prep min" value={prepTime} onChangeText={setPrepTime} keyboardType="number-pad" compact />
            <Field label="Cook min" value={cookTime} onChangeText={setCookTime} keyboardType="number-pad" compact />
          </View>

          <Field label="Tags (comma separated)" value={tags} onChangeText={setTags} />

          <Text style={styles.sectionLabel}>Nutrition per serving</Text>
          <View style={styles.fieldGrid}>
            <Field label="Calories" value={calories} onChangeText={setCalories} keyboardType="number-pad" compact />
            <Field label="Protein g" value={protein} onChangeText={setProtein} keyboardType="number-pad" compact />
          </View>
          <View style={styles.fieldGrid}>
            <Field label="Carbs g" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" compact />
            <Field label="Fat g" value={fat} onChangeText={setFat} keyboardType="number-pad" compact />
          </View>

          <Field
            label="Ingredients (one per line)"
            value={ingredients}
            onChangeText={setIngredients}
            multiline
          />
          <Field label="Steps (one per line)" value={steps} onChangeText={setSteps} multiline />
          <Pressable
            onPress={() => void handleSave()}
            disabled={!canSave || saving}
            style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : null}
            <Text style={styles.saveText}>{saving ? savingLabel : 'Save Changes'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  multiline,
  compact,
  ...props
}: {
  label: string;
  multiline?: boolean;
  compact?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={[styles.field, compact && styles.compactField]}>
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

function parseIngredientLine(line: string, index: number, existingId?: string): Ingredient {
  const match = line.match(/^(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])?\s*([a-zA-Z]+)?\s*(.*)$/);
  if (!match) return { id: existingId ?? `edit-${index}`, amount: '', unit: '', name: line };
  const [, amount = '', possibleUnit = '', remainder = ''] = match;
  const knownUnit = /^(tsp|tbsp|cup|cups|oz|lb|lbs|g|kg|ml|l|clove|cloves)$/i.test(possibleUnit);
  return {
    id: existingId ?? `edit-${index}`,
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
  image: { height: 180, borderRadius: radius.lg },
  imageButton: { alignItems: 'center', marginTop: -spacing.sm },
  imageButtonText: { ...typography.caption, color: colors.accent },
  field: { gap: spacing.sm },
  compactField: { flex: 1 },
  fieldGrid: { flexDirection: 'row', gap: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.textMuted },
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
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { ...typography.subtitle, color: '#fff' },
});
