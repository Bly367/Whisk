import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FolderPill } from '../../components/FolderPill';
import { MacroStrip, scaleNutrition } from '../../components/MacroStrip';
import { RecipeImage } from '../../components/RecipeImage';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { removeRecipeImage } from '../../services/media/recipeImages';
import {
  estimateNutritionFromIngredients,
  resolveRecipeNutrition,
} from '../../services/nutrition/estimateFromIngredients';
import { useAuthStore } from '../../store/authStore';
import { scaleIngredient, useRecipeStore } from '../../store/recipeStore';
import { Nutrition } from '../../types/recipe';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipeStore((state) => state.recipes.find((item) => item.id === id));
  const folders = useRecipeStore((state) => state.folders);
  const toggleFolder = useRecipeStore((state) => state.toggleFolder);
  const deleteRecipe = useRecipeStore((state) => state.deleteRecipe);
  const updateRecipe = useRecipeStore((state) => state.updateRecipe);
  const user = useAuthStore((state) => state.user);
  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [editingMacros, setEditingMacros] = useState(false);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Recipe not found</Text>
      </SafeAreaView>
    );
  }

  const ingredientFactor = servings / recipe.servings;
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const resolvedNutrition = resolveRecipeNutrition(recipe);
  const estimate = estimateNutritionFromIngredients(recipe.ingredients, recipe.servings);

  const openMacroEditor = () => {
    const perServing = resolvedNutrition?.nutrition;
    setCalories(perServing ? String(Math.round(perServing.calories)) : '');
    setProtein(perServing ? String(Math.round(perServing.protein)) : '');
    setCarbs(perServing ? String(Math.round(perServing.carbs)) : '');
    setFat(perServing ? String(Math.round(perServing.fat)) : '');
    setEditingMacros(true);
  };

  const saveMacros = () => {
    const next: Nutrition = {
      calories: Math.max(0, Number(calories) || 0),
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fat: Math.max(0, Number(fat) || 0),
    };
    updateRecipe(recipe.id, { nutrition: next });
    setEditingMacros(false);
  };

  const useEstimate = () => {
    if (!estimate) {
      Alert.alert('No estimate available', 'Add clearer ingredient amounts to estimate macros.');
      return;
    }
    setCalories(String(estimate.nutrition.calories));
    setProtein(String(estimate.nutrition.protein));
    setCarbs(String(estimate.nutrition.carbs));
    setFat(String(estimate.nutrition.fat));
  };

  const clearMacros = () => {
    updateRecipe(recipe.id, { nutrition: undefined });
    setEditingMacros(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete recipe?', `Remove "${recipe.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const imageRemoval =
            user && recipe.imageStoragePath
              ? removeRecipeImage(recipe.imageStoragePath, user.id).catch(() => undefined)
              : Promise.resolve();
          deleteRecipe(recipe.id);
          void imageRemoval;
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <RecipeImage
        imageUrl={recipe.imageUrl}
        imageStoragePath={recipe.imageStoragePath}
        gradient={recipe.imageGradient}
        style={styles.hero}
      >
        <SafeAreaView edges={['top']} style={styles.heroTop}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.heroActions}>
            <Pressable onPress={() => router.push(`/recipe/edit/${recipe.id}`)} style={styles.iconBtn}>
              <Ionicons name="create-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={() => router.push(`/cook/${recipe.id}`)} style={styles.cookBtn}>
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={styles.cookBtnText}>Cook Mode</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </RecipeImage>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{recipe.title}</Text>
        {recipe.description ? (
          <Text style={styles.description}>{recipe.description}</Text>
        ) : null}

        <View style={styles.statsRow}>
          {totalTime > 0 && (
            <View style={styles.stat}>
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={styles.statText}>{totalTime} min</Text>
            </View>
          )}
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={16} color={colors.accent} />
            <Text style={styles.statText}>{servings} servings</Text>
          </View>
        </View>

        {recipe.sourceUrl ? (
          <Pressable onPress={() => Linking.openURL(recipe.sourceUrl!)} style={styles.sourceRow}>
            <Ionicons name="open-outline" size={16} color={colors.accent} />
            <Text style={styles.sourceText} numberOfLines={1}>
              {recipe.sourceAttribution
                ? `Source: ${recipe.sourceAttribution}`
                : 'View original source'}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.servingControl}>
          <Text style={styles.sectionTitle}>Servings</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setServings((value) => Math.max(1, value - 1))}
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.servingCount}>{servings}</Text>
            <Pressable onPress={() => setServings((value) => value + 1)} style={styles.stepBtn}>
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {resolvedNutrition ? (
          <MacroStrip
            nutrition={scaleNutrition(resolvedNutrition.nutrition, servings)}
            showBars
            onEdit={openMacroEditor}
            label={
              resolvedNutrition.estimated
                ? `Estimated macros for ${servings} serving${servings === 1 ? '' : 's'}`
                : `Macros for ${servings} serving${servings === 1 ? '' : 's'}`
            }
          />
        ) : (
          <Pressable onPress={openMacroEditor} style={styles.addMacrosBtn}>
            <Ionicons name="nutrition-outline" size={18} color={colors.accent} />
            <Text style={styles.addMacrosText}>Add macros</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients.map((ingredient) => (
          <View key={ingredient.id} style={styles.ingredientRow}>
            <View style={styles.bullet} />
            <Text style={styles.ingredientText}>{scaleIngredient(ingredient, ingredientFactor)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Steps</Text>
        {recipe.steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <Text style={styles.stepNum}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Folders</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {folders.map((folder) => (
            <FolderPill
              key={folder.id}
              emoji={folder.emoji}
              name={folder.name}
              color={folder.color}
              selected={recipe.folderIds.includes(folder.id)}
              onPress={() => toggleFolder(recipe.id, folder.id)}
            />
          ))}
        </ScrollView>
      </ScrollView>

      <Modal visible={editingMacros} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit macros</Text>
            <Text style={styles.modalHint}>
              Values are per serving. Displayed totals scale with the servings stepper.
            </Text>
            <View style={styles.macroGrid}>
              <MacroField label="Calories" value={calories} onChangeText={setCalories} />
              <MacroField label="Protein g" value={protein} onChangeText={setProtein} />
              <MacroField label="Carbs g" value={carbs} onChangeText={setCarbs} />
              <MacroField label="Fat g" value={fat} onChangeText={setFat} />
            </View>
            {estimate ? (
              <Pressable onPress={useEstimate} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Fill from ingredient estimate</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={saveMacros} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Save macros</Text>
            </Pressable>
            {recipe.nutrition ? (
              <Pressable onPress={clearMacros} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryBtnText, { color: colors.danger }]}>
                  Clear and use estimate
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setEditingMacros(false)} style={styles.secondaryBtn}>
              <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MacroField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.macroField}>
      <Text style={styles.macroFieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        style={styles.macroInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missing: {
    color: colors.text,
  },
  hero: {
    height: 220,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  cookBtnText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.hero,
    color: colors.text,
    fontSize: 28,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourceText: {
    ...typography.caption,
    color: colors.accent,
    flex: 1,
  },
  servingControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingCount: {
    ...typography.subtitle,
    color: colors.text,
    minWidth: 24,
    textAlign: 'center',
  },
  addMacrosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addMacrosText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  ingredientText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNum: {
    ...typography.subtitle,
    color: colors.accent,
    width: 24,
  },
  stepText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  modalHint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  macroField: {
    width: '48%',
    flexGrow: 1,
    gap: spacing.xs,
  },
  macroFieldLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  macroInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  primaryBtnText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryBtnText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
});
