import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Collection, Tag } from '@/data/contracts';
import { getRepositories } from '@/data';
import {
  applyPantryAwareSearch,
  describePantrySearchMode,
  type PantryAwareRecipe,
} from '@/features/pantry';
import { applyLibraryFilters, type LibraryFilterState } from '@/features/recipes/libraryFilters';

export type LibraryData = {
  recipes: PantryAwareRecipe[];
  tags: Tag[];
  collections: Collection[];
  loading: boolean;
  pantryItemCount: number;
  pantryBanner: string | null;
  refresh: () => void;
};

export function useRecipeLibrary(filters: LibraryFilterState): LibraryData {
  const [recipes, setRecipes] = useState<PantryAwareRecipe[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [pantryItemCount, setPantryItemCount] = useState(0);
  const [pantryBanner, setPantryBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    try {
      const repos = getRepositories();
      const listed = repos.recipes.list({
        search: filters.search.trim() || undefined,
        tagIds: filters.tagIds.length ? filters.tagIds : undefined,
        status: 'any',
        sort: filters.sort,
      });

      let collectionIds: Set<string> | null = null;
      if (filters.collectionId) {
        collectionIds = new Set(repos.collections.listRecipeIds(filters.collectionId));
      }

      const filtered = applyLibraryFilters(listed, filters, collectionIds);
      const pantryItems = repos.pantry.list();
      const withPantry = applyPantryAwareSearch(filtered, pantryItems, filters.pantryMode);

      setRecipes(withPantry);
      setPantryItemCount(pantryItems.length);
      setPantryBanner(describePantrySearchMode(filters.pantryMode, pantryItems.length));
      setTags(repos.tags.list());
      setCollections(repos.collections.list());
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      refresh();
    }, [refresh]),
  );

  return { recipes, tags, collections, loading, pantryItemCount, pantryBanner, refresh };
}
