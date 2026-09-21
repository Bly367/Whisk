import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { EmptyLibrary } from '@/components/recipes/EmptyLibrary';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/tokens';
import {
  activeFilterCount,
  COOK_TIME_OPTIONS,
  DATE_ADDED_OPTIONS,
  PANTRY_MODE_OPTIONS,
  SORT_OPTIONS,
} from '@/features/recipes/libraryFilters';
import { useRecipeLibraryStore } from '@/features/recipes/libraryStore';
import { useRecipeLibrary } from '@/features/recipes/useRecipeLibrary';
import { useTheme } from '@/theme/ThemeProvider';

export default function RecipesScreen() {
  const { colors } = useTheme();
  const search = useRecipeLibraryStore((s) => s.search);
  const sort = useRecipeLibraryStore((s) => s.sort);
  const tagIds = useRecipeLibraryStore((s) => s.tagIds);
  const collectionId = useRecipeLibraryStore((s) => s.collectionId);
  const cookTime = useRecipeLibraryStore((s) => s.cookTime);
  const dateAdded = useRecipeLibraryStore((s) => s.dateAdded);
  const pantryMode = useRecipeLibraryStore((s) => s.pantryMode);
  const setSearch = useRecipeLibraryStore((s) => s.setSearch);
  const setSort = useRecipeLibraryStore((s) => s.setSort);
  const toggleTag = useRecipeLibraryStore((s) => s.toggleTag);
  const setCollectionId = useRecipeLibraryStore((s) => s.setCollectionId);
  const setCookTime = useRecipeLibraryStore((s) => s.setCookTime);
  const setDateAdded = useRecipeLibraryStore((s) => s.setDateAdded);
  const setPantryMode = useRecipeLibraryStore((s) => s.setPantryMode);
  const clearFilters = useRecipeLibraryStore((s) => s.clearFilters);

  const filters = useMemo(
    () => ({ search, sort, tagIds, collectionId, cookTime, dateAdded, pantryMode }),
    [search, sort, tagIds, collectionId, cookTime, dateAdded, pantryMode],
  );

  const { recipes, tags, collections, loading, pantryBanner, pantryItemCount } =
    useRecipeLibrary(filters);
  const filterCount = activeFilterCount(filters);
  const isEmptyLibrary = !loading && recipes.length === 0 && !search.trim() && filterCount === 0;

  return (
    <Screen testID="screen-recipes" scroll={false} style={styles.screen}>
      <View
        style={[
          styles.searchSticky,
          { backgroundColor: colors.canvas, borderBottomColor: colors.border },
        ]}
      >
        <Text variant="title1">Recipes</Text>
        <View style={styles.searchContainer}>
          <Text variant="body" style={{ color: colors.brand.yolk, fontSize: 20 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search recipes, ingredients..."
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Search recipes or ingredients"
            testID="recipes-search"
            style={[
              styles.searchInput,
              {
                color: colors.textPrimary,
              },
            ]}
          />
        </View>
        <View style={styles.sortRow}>
          <Text variant="caption" tone="secondary">
            Sort
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {SORT_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={sort === option.value}
                onPress={() => setSort(option.value)}
                testID={`sort-${option.value}`}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.filterBlock}>
          <View style={styles.pantryHeader}>
            <Text variant="caption" tone="secondary">
              Pantry
            </Text>
            <Pressable
              onPress={() => router.push('/pantry')}
              accessibilityRole="link"
              accessibilityLabel="Open pantry"
              testID="recipes-open-pantry"
            >
              <Text variant="callout" tone="info">
                Manage pantry{pantryItemCount > 0 ? ` (${pantryItemCount})` : ''}
              </Text>
            </Pressable>
          </View>
          <ChipRow>
            {PANTRY_MODE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={pantryMode === option.value}
                onPress={() => setPantryMode(option.value)}
                testID={`filter-pantry-${option.value}`}
                accessibilityHint={
                  option.value === 'off'
                    ? 'Do not rank or filter by pantry'
                    : option.value === 'boost'
                      ? 'Rank recipes by how many ingredients you already have'
                      : 'Show only recipes that use pantry items'
                }
              />
            ))}
          </ChipRow>
          {pantryBanner ? (
            <Text variant="callout" tone="info" testID="recipes-pantry-banner">
              {pantryBanner}
            </Text>
          ) : null}

          <Text variant="caption" tone="secondary">
            Filters
          </Text>
          <ChipRow>
            {COOK_TIME_OPTIONS.filter((o) => o.value !== 'any').map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={cookTime === option.value}
                onPress={() => setCookTime(cookTime === option.value ? 'any' : option.value)}
                testID={`filter-cook-${option.value}`}
              />
            ))}
            {DATE_ADDED_OPTIONS.filter((o) => o.value !== 'any').map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={dateAdded === option.value}
                onPress={() => setDateAdded(dateAdded === option.value ? 'any' : option.value)}
                testID={`filter-date-${option.value}`}
              />
            ))}
          </ChipRow>
          {tags.length ? (
            <>
              <Text variant="caption" tone="secondary">
                Tags
              </Text>
              <ChipRow>
                {tags.map((tag) => (
                  <Chip
                    key={tag.id}
                    label={tag.name}
                    selected={tagIds.includes(tag.id)}
                    onPress={() => toggleTag(tag.id)}
                    testID={`filter-tag-${tag.id}`}
                  />
                ))}
              </ChipRow>
            </>
          ) : null}
          {collections.length ? (
            <>
              <Text variant="caption" tone="secondary">
                Collections
              </Text>
              <ChipRow>
                {collections.map((collection) => (
                  <Chip
                    key={collection.id}
                    label={collection.name}
                    selected={collectionId === collection.id}
                    onPress={() =>
                      setCollectionId(collectionId === collection.id ? null : collection.id)
                    }
                    testID={`filter-collection-${collection.id}`}
                  />
                ))}
              </ChipRow>
            </>
          ) : null}
          {filterCount >= 2 ? (
            <Pressable
              onPress={clearFilters}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              testID="filters-clear-all"
            >
              <Text variant="callout" tone="info">
                Clear all
              </Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand.yolk} testID="recipes-loading" />
        ) : isEmptyLibrary ? (
          <EmptyLibrary onAdd={() => router.push('/recipe/edit/new')} />
        ) : recipes.length === 0 ? (
          <View style={styles.emptyResults} testID="recipes-no-results">
            <Text variant="headline">No matches</Text>
            <Text variant="body" tone="secondary">
              {pantryMode !== 'off' && pantryItemCount === 0
                ? 'Add pantry items, or turn pantry filter off.'
                : pantryMode === 'filter'
                  ? 'No recipes use items from your pantry yet. Try Boost, or add more pantry staples.'
                  : 'Try removing a filter or searching a related ingredient.'}
            </Text>
            {filterCount > 0 ? (
              <Button label="Clear filters" variant="secondary" onPress={clearFilters} />
            ) : null}
          </View>
        ) : (
          <View style={styles.list} testID="recipes-list">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                searchQuery={search}
                pantryLabel={recipe.pantryLabel}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {!isEmptyLibrary ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add recipe"
          onPress={() => router.push('/recipe/edit/new')}
          testID="recipes-fab"
          style={[
            styles.fab,
            {
              backgroundColor: colors.brand.yolk,
              shadowColor: colors.brand.yolk,
            },
          ]}
        >
          <Text variant="title1" style={{ color: colors.textOnYolk, lineHeight: 32 }}>+</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 0,
  },
  searchSticky: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Nunito_400Regular',
  },
  sortRow: {
    gap: spacing.sm,
  },
  chipScroll: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  filterBlock: {
    gap: spacing.sm,
  },
  pantryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  emptyResults: {
    gap: spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl + 80,
    right: spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});
