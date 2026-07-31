import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FolderPill } from '../../components/FolderPill';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { scaleIngredient, useRecipeStore } from '../../store/recipeStore';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipeStore((s) => s.recipes.find((r) => r.id === id));
  const folders = useRecipeStore((s) => s.folders);
  const toggleFolder = useRecipeStore((s) => s.toggleFolder);
  const [servings, setServings] = useState(recipe?.servings ?? 2);

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Recipe not found</Text>
      </SafeAreaView>
    );
  }

  const factor = servings / recipe.servings;
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={recipe.imageGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <SafeAreaView edges={['top']} style={styles.heroTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={() => router.push(`/cook/${recipe.id}`)} style={styles.cookBtn}>
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.cookBtnText}>Cook Mode</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>

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

        {recipe.nutrition ? (
          <View style={styles.macroCard}>
            <MacroBar label="Calories" value={`${Math.round(recipe.nutrition.calories * factor)}`} />
            <MacroBar label="Protein" value={`${Math.round(recipe.nutrition.protein * factor)}g`} color={colors.success} />
            <MacroBar label="Carbs" value={`${Math.round(recipe.nutrition.carbs * factor)}g`} color={colors.accentAlt} />
            <MacroBar label="Fat" value={`${Math.round(recipe.nutrition.fat * factor)}g`} color={colors.accent} />
          </View>
        ) : null}

        <View style={styles.servingControl}>
          <Text style={styles.sectionTitle}>Servings</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setServings((s) => Math.max(1, s - 1))}
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.servingCount}>{servings}</Text>
            <Pressable onPress={() => setServings((s) => s + 1)} style={styles.stepBtn}>
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients.map((ing) => (
          <View key={ing.id} style={styles.ingredientRow}>
            <View style={styles.bullet} />
            <Text style={styles.ingredientText}>{scaleIngredient(ing, factor)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Steps</Text>
        {recipe.steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}</Text>
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
    </View>
  );
}

function MacroBar({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.macroItem}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
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
  backBtn: {
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
  macroCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  macroLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 9,
  },
  macroValue: {
    ...typography.subtitle,
    color: colors.text,
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
});
