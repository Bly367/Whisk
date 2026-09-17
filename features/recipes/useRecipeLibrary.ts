import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Collection, RecipeListItem, Tag } from '@/data/contracts';
import { getRepositories } from '@/data';
import { applyLibraryFilters, type LibraryFilterState } from '@/features/recipes/libraryFilters';

export type LibraryData = {
  recipes: RecipeListItem[];
  tags: Tag[];
  collections: Collection[];
  loading: boolean;
  refresh: () => void;
};

export function useRecipeLibrary(filters: LibraryFilterState): LibraryData {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
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

      setRecipes(applyLibraryFilters(listed, filters, collectionIds));
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

  return { recipes, tags, collections, loading, refresh };
}
