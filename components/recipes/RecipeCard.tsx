import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/tokens';
import type { RecipeListItem } from '@/data/contracts';
import { explainSearchMatch } from '@/features/recipes/matchReason';
import { ensureMinTouchTarget, hitSlop } from '@/theme/a11y';
import { useTheme } from '@/theme/ThemeProvider';

export type RecipeCardProps = {
  recipe: RecipeListItem;
  searchQuery?: string;
  onPress: () => void;
};

function totalTimeLabel(recipe: RecipeListItem): string | null {
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  if (!recipe.prepMinutes && !recipe.cookMinutes) return null;
  return `${total} min`;
}

export function RecipeCard({ recipe, searchQuery = '', onPress }: RecipeCardProps) {
  const { colors } = useTheme();
  const match = explainSearchMatch(recipe, searchQuery);
  const time = totalTimeLabel(recipe);
  const tags = recipe.tagNames.slice(0, 2);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      accessibilityHint={match?.label}
      hitSlop={hitSlop}
      onPress={onPress}
      testID={`recipe-card-${recipe.id}`}
      style={(state) =>
        ensureMinTouchTarget({
          ...styles.card,
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: state.pressed ? 0.92 : 1,
        })
      }
    >
      <View
        style={[styles.thumb, { backgroundColor: colors.brand.yolkSoft }]}
        accessible={false}
      />
      <View style={styles.body}>
        <Text variant="headline" numberOfLines={2}>
          {recipe.title}
        </Text>
        {recipe.status === 'draft' ? (
          <Text variant="caption" tone="warning">
            Draft
          </Text>
        ) : null}
        <View style={styles.meta}>
          {time ? (
            <Text variant="caption" tone="secondary">
              {time}
            </Text>
          ) : null}
          {recipe.rating != null ? (
            <Text variant="caption" tone="secondary">
              ★ {recipe.rating.toFixed(1)}
            </Text>
          ) : null}
        </View>
        {tags.length ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {tags.join(' · ')}
          </Text>
        ) : null}
        {match ? (
          <Text
            variant="caption"
            tone="info"
            testID={`recipe-match-${recipe.id}`}
            style={styles.match}
          >
            {match.label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.control,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  match: {
    marginTop: spacing.xs,
  },
});
