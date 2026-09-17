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
import { radius, spacing } from '@/constants/tokens';
import {
  activeFilterCount,
  COOK_TIME_OPTIONS,
  DATE_ADDED_OPTIONS,
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
  const setSearch = useRecipeLibraryStore((s) => s.setSearch);
  const setSort = useRecipeLibraryStore((s) => s.setSort);
  const toggleTag = useRecipeLibraryStore((s) => s.toggleTag);
  const setCollectionId = useRecipeLibraryStore((s) => s.setCollectionId);
  const setCookTime = useRecipeLibraryStore((s) => s.setCookTime);
  const setDateAdded = useRecipeLibraryStore((s) => s.setDateAdded);
  const clearFilters = useRecipeLibraryStore((s) => s.clearFilters);

  const filters = useMemo(
    () => ({ search, sort, tagIds, collectionId, cookTime, dateAdded }),
    [search, sort, tagIds, collectionId, cookTime, dateAdded],
  );

  const { recipes, tags, collections, loading } = useRecipeLibrary(filters);
  const filterCount = activeFilterCount(filters);
  const isEmptyLibrary =
    !loading && recipes.length === 0 && !search.trim() && filterCount === 0;

  return (
    <Screen testID="screen-recipes" scroll={false} style={styles.screen}>
      <View
        style={[
          styles.searchSticky,
          { backgroundColor: colors.canvas, borderBottomColor: colors.border },
        ]}
      >
        <Text variant="title1">Recipes</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search recipes or ingredients"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Search recipes or ingredients"
          testID="recipes-search"
          style={[
            styles.search,
            {
              backgroundColor: colors.sunken,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
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

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.filterBlock}>
          <Text variant="caption" tone="secondary">
            Filters
          </Text>
          <ChipRow>
            {COOK_TIME_OPTIONS.filter((o) => o.value !== 'any').map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={cookTime === option.value}
                onPress={() =>
                  setCookTime(cookTime === option.value ? 'any' : option.value)
                }
                testID={`filter-cook-${option.value}`}
              />
            ))}
            {DATE_ADDED_OPTIONS.filter((o) => o.value !== 'any').map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={dateAdded === option.value}
                onPress={() =>
                  setDateAdded(dateAdded === option.value ? 'any' : option.value)
                }
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
                      setCollectionId(
                        collectionId === collection.id ? null : collection.id,
                      )
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
              Try removing a filter or searching a related ingredient.
            </Text>
            {filterCount > 0 ? (
              <Button
                label="Clear filters"
                variant="secondary"
                onPress={clearFilters}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.list} testID="recipes-list">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                searchQuery={search}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
              />
            ))}
          </View>
        )}

        {!isEmptyLibrary ? (
          <Button
            label="Create recipe"
            variant="secondary"
            onPress={() => router.push('/recipe/edit/new')}
            testID="recipes-create-cta"
            style={styles.create}
          />
        ) : null}
      </ScrollView>
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
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
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
  list: {
    gap: spacing.md,
  },
  emptyResults: {
    gap: spacing.sm,
  },
  create: {
    alignSelf: 'flex-start',
  },
});
