import type { RecipeCreateInput, RecipeWithIngredients } from '@/data/contracts';
import { getRepositories } from '@/data/repositories';

import type { ImportDraft } from '@/import/types';

export class ImportCommitError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'empty_title'
      | 'empty_recipe'
      | 'already_saved'
      | 'persist_failed',
  ) {
    super(message);
    this.name = 'ImportCommitError';
  }
}

/** Map a reviewed draft to the W2 create contract. */
export function toRecipeCreateInput(draft: ImportDraft): RecipeCreateInput {
  return {
    title: draft.title.trim(),
    notes: draft.notes,
    sourceUrl: draft.sourceUrl,
    sourceName: draft.sourceName,
    imageUri: draft.imageUri,
    servings: draft.servings,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    instructions: draft.instructions
      .map((step, index) => ({
        ...step,
        text: step.text.trim(),
        position: step.position ?? index,
      }))
      .filter((step) => step.text.length > 0),
    ingredients: draft.ingredients
      .map((ing, index) => ({
        ...ing,
        name: ing.name.trim(),
        position: ing.position ?? index,
      }))
      .filter((ing) => ing.name.length > 0),
    status: 'published',
  };
}

/**
 * Trust gate: refuse blank or content-empty saves.
 * Callers must show preview and get explicit confirm before invoking.
 */
export function assertDraftReadyToSave(draft: ImportDraft): RecipeCreateInput {
  const input = toRecipeCreateInput(draft);
  if (!input.title.trim()) {
    throw new ImportCommitError(
      'Add a recipe title before saving.',
      'empty_title',
    );
  }
  const hasIngredients = (input.ingredients?.length ?? 0) > 0;
  const hasInstructions = (input.instructions?.length ?? 0) > 0;
  if (!hasIngredients && !hasInstructions) {
    throw new ImportCommitError(
      'Add ingredients or steps before saving. Whisk will not store an empty recipe.',
      'empty_recipe',
    );
  }
  return input;
}

export type CommitImportOptions = {
  /** Prevent double-save of the same preview session. */
  alreadySavedDraftIds?: Set<string>;
  create?: (input: RecipeCreateInput) => RecipeWithIngredients;
};

/**
 * Persist only after preview confirmation.
 * Uses `RecipeCreateInput` → `recipes.create` from `@/data`.
 */
export function commitImportDraft(
  draft: ImportDraft,
  options: CommitImportOptions = {},
): RecipeWithIngredients {
  if (options.alreadySavedDraftIds?.has(draft.id)) {
    throw new ImportCommitError(
      'This import was already saved. Open it from Recipes instead of saving again.',
      'already_saved',
    );
  }

  const input = assertDraftReadyToSave(draft);
  const create =
    options.create ?? ((payload) => getRepositories().recipes.create(payload));

  try {
    const recipe = create(input);
    options.alreadySavedDraftIds?.add(draft.id);
    return recipe;
  } catch (error) {
    if (error instanceof ImportCommitError) throw error;
    throw new ImportCommitError(
      'Could not save this recipe locally. Try again — nothing was stored.',
      'persist_failed',
    );
  }
}
