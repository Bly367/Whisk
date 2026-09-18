import { create } from 'zustand';

import {
  DEFAULT_LIBRARY_FILTERS,
  type LibraryFilterState,
} from '@/features/recipes/libraryFilters';
import type { PantrySearchMode } from '@/features/pantry';
import type { RecipeSort } from '@/data/contracts';

type LibraryStore = LibraryFilterState & {
  setSearch: (search: string) => void;
  setSort: (sort: RecipeSort) => void;
  toggleTag: (tagId: string) => void;
  setCollectionId: (collectionId: string | null) => void;
  setCookTime: (cookTime: LibraryFilterState['cookTime']) => void;
  setDateAdded: (dateAdded: LibraryFilterState['dateAdded']) => void;
  setPantryMode: (pantryMode: PantrySearchMode) => void;
  clearFilters: () => void;
};

/**
 * Preserves Recipes-tab search/filter/sort when switching tabs.
 * Domain data stays in SQLite; this is UI session only.
 */
export const useRecipeLibraryStore = create<LibraryStore>((set, get) => ({
  ...DEFAULT_LIBRARY_FILTERS,
  setSearch: (search) => set({ search }),
  setSort: (sort) => set({ sort }),
  toggleTag: (tagId) => {
    const current = get().tagIds;
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    set({ tagIds: next });
  },
  setCollectionId: (collectionId) => set({ collectionId }),
  setCookTime: (cookTime) => set({ cookTime }),
  setDateAdded: (dateAdded) => set({ dateAdded }),
  setPantryMode: (pantryMode) => set({ pantryMode }),
  clearFilters: () =>
    set({
      tagIds: [],
      collectionId: null,
      cookTime: 'any',
      dateAdded: 'any',
      pantryMode: 'off',
    }),
}));
