import type { RecipeListItem } from '@/data/contracts';
import {
  formatPantryCoverageLabel,
  scorePantryCoverage,
  type PantryCoverage,
} from '@/features/pantry/coverage';

export type PantrySearchMode = 'off' | 'boost' | 'filter';

export type PantryAwareRecipe = RecipeListItem & {
  pantryCoverage: PantryCoverage;
  /** Clear, non-silent explanation when pantry mode is active and pantry has items. */
  pantryLabel: string | null;
};

export type PantryNameSource = string | { name: string; depletedAt?: string | null };

function activePantryNames(sources: PantryNameSource[]): string[] {
  const names: string[] = [];
  for (const source of sources) {
    if (typeof source === 'string') {
      const trimmed = source.trim();
      if (trimmed) names.push(trimmed);
      continue;
    }
    if (source.depletedAt) continue;
    const trimmed = source.name.trim();
    if (trimmed) names.push(trimmed);
  }
  return names;
}

/**
 * Banner / helper copy for the active pantry search mode.
 * Returns null when mode is off (no silent ranking).
 */
export function describePantrySearchMode(
  mode: PantrySearchMode,
  pantryItemCount: number,
): string | null {
  if (mode === 'off') return null;

  if (pantryItemCount <= 0) {
    if (mode === 'boost') {
      return 'Your pantry is empty — add items to rank recipes by pantry coverage.';
    }
    return 'Your pantry is empty — add items to filter recipes you can cook with what you have.';
  }

  if (mode === 'boost') {
    return 'Ranked by pantry coverage — recipes you can cook with what you have appear first.';
  }
  return 'Only showing recipes that use items in your pantry.';
}

/**
 * Apply pantry boost (reorder) or filter on a recipe list.
 * Always attaches explicit coverage labels when mode ≠ off and pantry is non-empty.
 */
export function applyPantryAwareSearch(
  recipes: RecipeListItem[],
  pantrySources: PantryNameSource[],
  mode: PantrySearchMode,
): PantryAwareRecipe[] {
  const pantryNames = activePantryNames(pantrySources);

  const annotated: PantryAwareRecipe[] = recipes.map((recipe) => {
    const pantryCoverage = scorePantryCoverage(recipe.ingredientNames, pantryNames);
    const pantryLabel =
      mode === 'off' || pantryNames.length === 0
        ? null
        : formatPantryCoverageLabel(pantryCoverage);
    return {
      ...recipe,
      pantryCoverage,
      pantryLabel,
    };
  });

  if (mode === 'off') {
    return annotated;
  }

  if (pantryNames.length === 0) {
    // Empty pantry: do not silently pretend coverage exists.
    return mode === 'filter' ? [] : annotated;
  }

  if (mode === 'filter') {
    return annotated
      .filter((recipe) => recipe.pantryCoverage.matchedCount > 0)
      .sort(compareByCoverage);
  }

  // boost
  return [...annotated].sort(compareByCoverage);
}

function compareByCoverage(a: PantryAwareRecipe, b: PantryAwareRecipe): number {
  if (b.pantryCoverage.ratio !== a.pantryCoverage.ratio) {
    return b.pantryCoverage.ratio - a.pantryCoverage.ratio;
  }
  if (b.pantryCoverage.matchedCount !== a.pantryCoverage.matchedCount) {
    return b.pantryCoverage.matchedCount - a.pantryCoverage.matchedCount;
  }
  return 0;
}
