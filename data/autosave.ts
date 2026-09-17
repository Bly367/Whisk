import type {
  AutosaveDraftInput,
  AutosaveResult,
  RecipeWithIngredients,
} from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { createRecipeRepository } from '@/data/repositories/recipes';
import { reportLocalPersistFailure, reportLocalPersistSuccess } from '@/data/sync/statusStore';

export type AutosaveOptions = {
  /** Debounce window in ms; default 400. Pass 0 to flush immediately. */
  debounceMs?: number;
};

type Pending = {
  timer: ReturnType<typeof setTimeout> | null;
  latest: AutosaveDraftInput;
  resolvers: Array<{
    resolve: (value: AutosaveResult) => void;
    reject: (reason?: unknown) => void;
  }>;
};

/**
 * Autosave helpers for recipe drafts.
 * Persists to SQLite on every flush so drafts survive backgrounding / relaunch.
 * Never reports success until local write completes.
 */
export function createRecipeAutosave(db: DbClient, options: AutosaveOptions = {}) {
  const debounceMs = options.debounceMs ?? 400;
  const recipes = createRecipeRepository(db);
  const pendingByKey = new Map<string, Pending>();

  function keyFor(input: AutosaveDraftInput): string {
    return input.recipeId ?? '__new__';
  }

  function flush(key: string): void {
    const pending = pendingByKey.get(key);
    if (!pending) {
      return;
    }
    pendingByKey.delete(key);
    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    try {
      let recipe: RecipeWithIngredients;
      const { recipeId, patch } = pending.latest;

      if (recipeId) {
        recipe = recipes.update(recipeId, {
          ...patch,
          status: patch.status ?? 'draft',
        });
      } else {
        recipe = recipes.create({
          title: patch.title ?? 'Untitled draft',
          notes: patch.notes,
          sourceUrl: patch.sourceUrl,
          sourceName: patch.sourceName,
          imageUri: patch.imageUri,
          servings: patch.servings,
          prepMinutes: patch.prepMinutes,
          cookMinutes: patch.cookMinutes,
          rating: patch.rating,
          instructions: patch.instructions,
          ingredients: patch.ingredients,
          tagIds: patch.tagIds,
          isFavorite: patch.isFavorite,
          status: 'draft',
        });
      }

      reportLocalPersistSuccess();
      const result: AutosaveResult = {
        recipe,
        persistedAt: recipe.updatedAt,
      };
      for (const r of pending.resolvers) {
        r.resolve(result);
      }
    } catch (error) {
      reportLocalPersistFailure(
        error instanceof Error ? error.message : 'Autosave failed',
      );
      for (const r of pending.resolvers) {
        r.reject(error);
      }
    }
  }

  return {
    /**
     * Queue a draft patch. Resolves only after SQLite persistence succeeds.
     * Concurrent edits for the same recipe coalesce to the latest patch.
     */
    saveDraft(input: AutosaveDraftInput): Promise<AutosaveResult> {
      const key = keyFor(input);
      return new Promise<AutosaveResult>((resolve, reject) => {
        const existing = pendingByKey.get(key);
        if (existing) {
          existing.latest = {
            recipeId: input.recipeId ?? existing.latest.recipeId,
            patch: { ...existing.latest.patch, ...input.patch },
          };
          existing.resolvers.push({ resolve, reject });
          if (debounceMs <= 0) {
            flush(key);
          }
          return;
        }

        const entry: Pending = {
          timer: null,
          latest: input,
          resolvers: [{ resolve, reject }],
        };
        pendingByKey.set(key, entry);

        if (debounceMs <= 0) {
          flush(key);
        } else {
          entry.timer = setTimeout(() => flush(key), debounceMs);
        }
      });
    },

    /** Force-flush any pending draft for a recipe (or all). */
    flushNow(recipeId?: string): void {
      if (recipeId) {
        flush(recipeId);
        return;
      }
      for (const key of [...pendingByKey.keys()]) {
        flush(key);
      }
    },

    /** Load an existing draft by id (offline-safe). */
    getDraft(recipeId: string): RecipeWithIngredients | null {
      const recipe = recipes.getById(recipeId);
      if (!recipe || recipe.status !== 'draft') {
        return null;
      }
      return recipe;
    },

    listDrafts(): RecipeWithIngredients[] {
      return recipes
        .list({ status: 'draft', sort: 'newest' })
        .map((item) => recipes.getById(item.id))
        .filter((r): r is RecipeWithIngredients => r !== null);
    },
  };
}

export type RecipeAutosave = ReturnType<typeof createRecipeAutosave>;
