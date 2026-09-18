import type {
  RecipeCreateInput,
  RecipeWithIngredients,
} from '@/data/contracts';
import type { CompatRepository } from '@/data/repositories/compat';
import type { RecipeRepository } from '@/data/repositories/recipes';

import type {
  CompatConflictPolicy,
  CompatImportDraft,
  CompatMatchExistingBy,
  CompatSkippedImport,
} from '@/import/compat/types';

const COMPAT_UID_PARAM = 'whisk_compat_uid';

export function embedCompatUid(sourceUrl: string | null, externalUid: string | null): string | null {
  if (!externalUid) return sourceUrl;
  if (!sourceUrl?.trim()) {
    return `whisk-compat://paprika/${externalUid}`;
  }
  try {
    const url = new URL(sourceUrl);
    url.searchParams.set(COMPAT_UID_PARAM, externalUid);
    return url.toString();
  } catch {
    return sourceUrl;
  }
}

export function extractCompatUid(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  if (sourceUrl.startsWith('whisk-compat://paprika/')) {
    return sourceUrl.slice('whisk-compat://paprika/'.length) || null;
  }
  try {
    return new URL(sourceUrl).searchParams.get(COMPAT_UID_PARAM);
  } catch {
    return null;
  }
}

export function draftToRecipeCreateInput(draft: CompatImportDraft): RecipeCreateInput {
  return {
    title: draft.title.trim(),
    notes: draft.notes,
    sourceUrl: embedCompatUid(draft.sourceUrl, draft.externalUid),
    sourceName: draft.sourceName,
    imageUri: draft.imageUri,
    servings: draft.servings,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    rating: draft.rating,
    ingredients: draft.ingredients,
    instructions: draft.instructions,
    status: 'published',
  };
}

function findExistingRecipe(
  draft: CompatImportDraft,
  recipesRepo: RecipeRepository,
  matchExistingBy: CompatMatchExistingBy,
): RecipeWithIngredients | null {
  if (matchExistingBy === 'none') return null;

  const list = recipesRepo.list({ status: 'any', sort: 'newest' });
  for (const item of list) {
    const full = recipesRepo.getById(item.id);
    if (!full || full.deletedAt) continue;

    if (matchExistingBy === 'externalUid' && draft.externalUid) {
      const existingUid = extractCompatUid(full.sourceUrl);
      if (existingUid && existingUid === draft.externalUid) {
        return full;
      }
    }

    if (matchExistingBy === 'sourceUrl' && draft.sourceUrl) {
      const draftUrl = draft.sourceUrl;
      const existing = full.sourceUrl;
      if (!existing) continue;
      // Compare without our compat uid query param.
      const normalize = (raw: string) => {
        try {
          const url = new URL(raw);
          url.searchParams.delete(COMPAT_UID_PARAM);
          return url.toString();
        } catch {
          return raw;
        }
      };
      if (normalize(existing) === normalize(draftUrl)) {
        return full;
      }
    }
  }
  return null;
}

function wasUserEdited(recipe: RecipeWithIngredients): boolean {
  return recipe.localRevision > 1 || recipe.updatedAt !== recipe.createdAt;
}

export type CommitCompatImportInput = {
  jobId: string;
  drafts: CompatImportDraft[];
  recipesRepo: RecipeRepository;
  compatRepo: CompatRepository;
  matchExistingBy?: CompatMatchExistingBy;
  /** Default: skip — never silently overwrite user edits. */
  conflictPolicy?: CompatConflictPolicy;
};

export type CommitCompatImportResult = {
  recipes: RecipeWithIngredients[];
  skipped: CompatSkippedImport[];
};

/**
 * Persist recipes only after preview confirmation.
 * Default conflict policy skips matches (especially user-edited rows).
 */
export function commitCompatImport(input: CommitCompatImportInput): CommitCompatImportResult {
  const matchExistingBy = input.matchExistingBy ?? 'none';
  const conflictPolicy = input.conflictPolicy ?? 'skip';
  const recipes: RecipeWithIngredients[] = [];
  const skipped: CompatSkippedImport[] = [];

  for (const draft of input.drafts) {
    const existing = findExistingRecipe(draft, input.recipesRepo, matchExistingBy);
    if (existing) {
      if (conflictPolicy === 'overwrite') {
        const updated = input.recipesRepo.update(existing.id, draftToRecipeCreateInput(draft));
        recipes.push(updated);
        continue;
      }
      if (conflictPolicy === 'skip') {
        skipped.push({
          draftId: draft.id,
          existingRecipeId: existing.id,
          reason: wasUserEdited(existing) ? 'user_edited' : 'already_exists',
          title: draft.title,
        });
        continue;
      }
      // create_new: fall through and insert another row
    }

    const created = input.recipesRepo.create(draftToRecipeCreateInput(draft));
    recipes.push(created);
  }

  input.compatRepo.markImportCommitted(input.jobId);
  return { recipes, skipped };
}
