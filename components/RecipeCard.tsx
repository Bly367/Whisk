import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { resolveRecipeNutrition } from '../services/nutrition/estimateFromIngredients';
import { Recipe } from '../types/recipe';
import { RecipeImage } from './RecipeImage';

const sourceLabels: Record<Recipe['source'], string> = {
  url: 'Web',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  manual: 'Manual',
  photo: 'Photo',
  video: 'Video',
  cookbook: 'Cookbook',
};

interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
  variant?: 'grid' | 'hero';
}

export function RecipeCard({ recipe, onPress, variant = 'grid' }: RecipeCardProps) {
  const isHero = variant === 'hero';
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const resolved = resolveRecipeNutrition(recipe);
  const nutrition = resolved?.nutrition;
  const estimated = resolved?.estimated ?? false;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}, ${sourceLabels[recipe.source]}`}
      style={({ pressed }) => [
        styles.card,
        isHero && styles.heroCard,
        pressed && styles.pressed,
      ]}
    >
      <RecipeImage
        imageUrl={recipe.imageUrl}
        imageStoragePath={recipe.imageStoragePath}
        gradient={recipe.imageGradient}
        style={[styles.image, isHero && styles.heroImage]}
      >
        <View style={styles.imageOverlay}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>{sourceLabels[recipe.source]}</Text>
          </View>
          {nutrition ? (
            <View style={styles.calBadge}>
              <Text style={styles.calText}>
                {Math.round(nutrition.calories)} cal/serving{estimated ? ' · est.' : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </RecipeImage>

      <View style={styles.content}>
        <Text style={[styles.title, isHero && styles.heroTitle]} numberOfLines={2}>
          {recipe.title}
        </Text>
        {recipe.description && isHero ? (
          <Text style={styles.description} numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {totalTime > 0 ? <Text style={styles.meta}>{totalTime} min</Text> : null}
          <Text style={styles.meta}>{recipe.servings} servings</Text>
        </View>
        {nutrition ? (
          <View style={styles.macroRow}>
            <Text style={[styles.macroChip, styles.protein]}>
              P {Math.round(nutrition.protein)}g
            </Text>
            <Text style={[styles.macroChip, styles.carbs]}>
              C {Math.round(nutrition.carbs)}g
            </Text>
            <Text style={[styles.macroChip, styles.fat]}>
              F {Math.round(nutrition.fat)}g
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroCard: {
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  image: {
    height: 120,
    justifyContent: 'flex-start',
    padding: spacing.sm,
  },
  heroImage: {
    height: 180,
  },
  imageOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  sourceText: {
    ...typography.label,
    color: colors.text,
    fontSize: 10,
  },
  calBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  calText: {
    ...typography.label,
    color: colors.text,
    fontSize: 10,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  heroTitle: {
    ...typography.title,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  macroChip: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  protein: { color: colors.success },
  carbs: { color: colors.accentAlt },
  fat: { color: colors.accent },
});
