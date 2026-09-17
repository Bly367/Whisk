import type { RecipeListItem } from '@/data/contracts';

export type MatchField = 'ingredient' | 'tag' | 'notes' | 'source';

export type SearchMatch = {
  field: MatchField;
  /** Plain-language reason shown under the recipe title. */
  label: string;
  /** The specific value that matched (ingredient name, tag, etc.). */
  matchedValue: string;
};

function includesQuery(haystack: string | null | undefined, query: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(query);
}

/**
 * Explain why a recipe matched a search when the query is not in the title.
 * Returns null for empty query, title matches, or no explainable field match.
 */
export function explainSearchMatch(item: RecipeListItem, rawQuery: string): SearchMatch | null {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return null;

  if (includesQuery(item.title, query)) {
    return null;
  }

  const ingredient = item.ingredientNames.find((name) => includesQuery(name, query));
  if (ingredient) {
    return {
      field: 'ingredient',
      label: `Matched ingredient: ${ingredient}`,
      matchedValue: ingredient,
    };
  }

  const tag = item.tagNames.find((name) => includesQuery(name, query));
  if (tag) {
    return {
      field: 'tag',
      label: `Matched tag: ${tag}`,
      matchedValue: tag,
    };
  }

  if (includesQuery(item.notes, query)) {
    return {
      field: 'notes',
      label: 'Matched in notes',
      matchedValue: item.notes!.trim(),
    };
  }

  if (includesQuery(item.sourceName, query) || includesQuery(item.sourceUrl, query)) {
    const value = item.sourceName?.trim() || item.sourceUrl?.trim() || 'source';
    return {
      field: 'source',
      label: `Matched source: ${value}`,
      matchedValue: value,
    };
  }

  return null;
}
