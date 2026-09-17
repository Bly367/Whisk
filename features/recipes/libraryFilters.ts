import type { Collection, RecipeListItem, RecipeSort, Tag } from '@/data/contracts';

export type CookTimeFilter = 'any' | 'le15' | 'le30' | 'le60';
export type DateAddedFilter = 'any' | 'week' | 'month';

export type LibraryFilterState = {
  search: string;
  tagIds: string[];
  collectionId: string | null;
  cookTime: CookTimeFilter;
  dateAdded: DateAddedFilter;
  sort: RecipeSort;
};

export const DEFAULT_LIBRARY_FILTERS: LibraryFilterState = {
  search: '',
  tagIds: [],
  collectionId: null,
  cookTime: 'any',
  dateAdded: 'any',
  sort: 'newest',
};

export const SORT_OPTIONS: Array<{ value: RecipeSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title_asc', label: 'A–Z' },
  { value: 'recently_cooked', label: 'Recently cooked' },
  { value: 'rating', label: 'Rating' },
];

export const COOK_TIME_OPTIONS: Array<{ value: CookTimeFilter; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: 'le15', label: '≤ 15 min' },
  { value: 'le30', label: '≤ 30 min' },
  { value: 'le60', label: '≤ 60 min' },
];

export const DATE_ADDED_OPTIONS: Array<{ value: DateAddedFilter; label: string }> = [
  { value: 'any', label: 'Any date' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

function totalMinutes(item: RecipeListItem): number | null {
  if (item.prepMinutes == null && item.cookMinutes == null) return null;
  return (item.prepMinutes ?? 0) + (item.cookMinutes ?? 0);
}

function withinDateWindow(iso: string, filter: DateAddedFilter, now = new Date()): boolean {
  if (filter === 'any') return true;
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return true;
  const ms = filter === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return now.getTime() - created.getTime() <= ms;
}

/**
 * Apply client-side filters that complement `RecipeListQuery`
 * (collection membership, cook time, date added).
 */
export function applyLibraryFilters(
  items: RecipeListItem[],
  filters: LibraryFilterState,
  collectionRecipeIds: Set<string> | null,
  now = new Date(),
): RecipeListItem[] {
  return items.filter((item) => {
    if (collectionRecipeIds && !collectionRecipeIds.has(item.id)) {
      return false;
    }

    if (filters.cookTime !== 'any') {
      const minutes = totalMinutes(item);
      if (minutes == null) return false;
      const max =
        filters.cookTime === 'le15' ? 15 : filters.cookTime === 'le30' ? 30 : 60;
      if (minutes > max) return false;
    }

    if (!withinDateWindow(item.createdAt, filters.dateAdded, now)) {
      return false;
    }

    return true;
  });
}

export function activeFilterCount(filters: LibraryFilterState): number {
  let count = 0;
  if (filters.tagIds.length) count += 1;
  if (filters.collectionId) count += 1;
  if (filters.cookTime !== 'any') count += 1;
  if (filters.dateAdded !== 'any') count += 1;
  return count;
}

export function collectionLabel(
  collections: Collection[],
  collectionId: string | null,
): string | null {
  if (!collectionId) return null;
  return collections.find((c) => c.id === collectionId)?.name ?? null;
}

export function tagLabels(tags: Tag[], tagIds: string[]): string[] {
  const byId = new Map(tags.map((t) => [t.id, t.name]));
  return tagIds.map((id) => byId.get(id) ?? id);
}
