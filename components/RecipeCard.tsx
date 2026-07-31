import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isHero && styles.heroCard,
        pressed && styles.pressed,
      ]}
    >
      <RecipeImage
        imageUrl={recipe.imageUrl}
        gradient={recipe.imageGradient}
        style={[styles.image, isHero && styles.heroImage]}
      >
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceText}>{sourceLabels[recipe.source]}</Text>
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
          {totalTime > 0 && <Text style={styles.meta}>{totalTime} min</Text>}
          {recipe.nutrition?.calories ? (
            <Text style={styles.meta}>{recipe.nutrition.calories} cal</Text>
          ) : null}
          <Text style={styles.meta}>{recipe.servings} servings</Text>
        </View>
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
});
