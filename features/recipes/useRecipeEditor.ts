import { useCallback, useEffect, useRef, useState } from 'react';

import type { CookStep, IngredientInput, RecipeWithIngredients } from '@/data/contracts';
import { createRecipeAutosave, getDatabase, getRepositories, type RecipeAutosave } from '@/data';
import { createId } from '@/data/util';

export type EditorDraft = {
  title: string;
  notes: string;
  sourceUrl: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  ingredientsText: string;
  instructionsText: string;
  tagNames: string;
  collectionIds: string[];
};

function toIngredients(text: string): IngredientInput[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(
        /^(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+(?:\.\d+)?)\s+([a-zA-Z.]+)\s+(.+)$/,
      );
      if (match) {
        return {
          quantity: match[1],
          unit: match[2],
          name: match[3],
          position: index,
        };
      }
      return { name: line, position: index };
    });
}

function toInstructions(text: string): CookStep[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: createId(),
      text: line.replace(/^\d+[\).\s]+/, ''),
      position: index,
    }));
}

function ingredientsToText(recipe: RecipeWithIngredients): string {
  return recipe.ingredients
    .map((ing) => [ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ').trim())
    .join('\n');
}

function instructionsToText(recipe: RecipeWithIngredients): string {
  return recipe.instructions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((step) => step.text)
    .join('\n');
}

function emptyDraft(): EditorDraft {
  return {
    title: '',
    notes: '',
    sourceUrl: '',
    servings: '4',
    prepMinutes: '',
    cookMinutes: '',
    ingredientsText: '',
    instructionsText: '',
    tagNames: '',
    collectionIds: [],
  };
}

function draftFromRecipe(recipe: RecipeWithIngredients, tagNames: string[]): EditorDraft {
  return {
    title: recipe.title === 'Untitled draft' ? '' : recipe.title,
    notes: recipe.notes ?? '',
    sourceUrl: recipe.sourceUrl ?? '',
    servings: recipe.servings != null ? String(recipe.servings) : '4',
    prepMinutes: recipe.prepMinutes != null ? String(recipe.prepMinutes) : '',
    cookMinutes: recipe.cookMinutes != null ? String(recipe.cookMinutes) : '',
    ingredientsText: ingredientsToText(recipe),
    instructionsText: instructionsToText(recipe),
    tagNames: tagNames.join(', '),
    collectionIds: [],
  };
}

export type UseRecipeEditorResult = {
  draft: EditorDraft;
  recipeId: string | null;
  status: 'draft' | 'published' | null;
  saving: boolean;
  lastSavedAt: string | null;
  error: string | null;
  updateField: <K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) => void;
  publish: () => Promise<RecipeWithIngredients | null>;
  softDelete: () => void;
};

/**
 * Manual recipe editor with autosave.
 * Always reuses the recipe id returned from the first `saveDraft` so
 * anonymous drafts never fork into duplicates (W2 race fix contract).
 */
export function useRecipeEditor(initialId?: string | null): UseRecipeEditorResult {
  const autosaveRef = useRef<RecipeAutosave | null>(null);
  /** Authoritative id for subsequent saves — set from first saveDraft result. */
  const recipeIdRef = useRef<string | null>(initialId ?? null);
  const draftRef = useRef<EditorDraft>(emptyDraft());
  const readyRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const [recipeId, setRecipeId] = useState<string | null>(initialId ?? null);
  const [status, setStatus] = useState<'draft' | 'published' | null>(null);
  const [draft, setDraft] = useState<EditorDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getDatabase();
    autosaveRef.current = createRecipeAutosave(db, { debounceMs: 400 });
    const repos = getRepositories();

    if (initialId) {
      const existing = repos.recipes.getById(initialId);
      if (existing) {
        const tags = repos.tags.list();
        const names = existing.tagIds
          .map((id) => tags.find((t) => t.id === id)?.name)
          .filter((n): n is string => !!n);
        const next = draftFromRecipe(existing, names);
        draftRef.current = next;
        setDraft(next);
        recipeIdRef.current = existing.id;
        setRecipeId(existing.id);
        setStatus(existing.status);
        setLastSavedAt(existing.updatedAt);

        const ownedCollections = repos.collections
          .list()
          .filter((c) => repos.collections.listRecipeIds(c.id).includes(existing.id))
          .map((c) => c.id);
        if (ownedCollections.length) {
          const withCollections = { ...next, collectionIds: ownedCollections };
          draftRef.current = withCollections;
          setDraft(withCollections);
        }
      }
    }
    readyRef.current = true;
  }, [initialId]);

  const persist = useCallback(async (next: EditorDraft) => {
    const autosave = autosaveRef.current;
    if (!autosave) return;

    const repos = getRepositories();
    const tagIds = next.tagNames
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((name) => repos.tags.upsertByName(name).id);

    const servings = Number(next.servings);
    const prepMinutes = next.prepMinutes.trim() ? Number(next.prepMinutes) : null;
    const cookMinutes = next.cookMinutes.trim() ? Number(next.cookMinutes) : null;

    // Prefer the id from the first successful saveDraft; fall back to W2
    // sessionAnonymousDraftId so stale closures cannot fork a second draft.
    const knownId = recipeIdRef.current ?? autosave.getSessionDraftId() ?? undefined;

    setSaving(true);
    setError(null);
    try {
      const result = await autosave.saveDraft({
        recipeId: knownId,
        patch: {
          title: next.title.trim() || 'Untitled draft',
          notes: next.notes.trim() || null,
          sourceUrl: next.sourceUrl.trim() || null,
          servings: Number.isFinite(servings) && servings > 0 ? servings : null,
          prepMinutes: prepMinutes != null && Number.isFinite(prepMinutes) ? prepMinutes : null,
          cookMinutes: cookMinutes != null && Number.isFinite(cookMinutes) ? cookMinutes : null,
          ingredients: toIngredients(next.ingredientsText),
          instructions: toInstructions(next.instructionsText),
          tagIds,
          status: 'draft',
        },
      });

      recipeIdRef.current = result.recipe.id;
      setRecipeId(result.recipe.id);
      setStatus(result.recipe.status);
      setLastSavedAt(result.persistedAt);

      const collections = repos.collections.list();
      for (const collection of collections) {
        const members = repos.collections.listRecipeIds(collection.id);
        const shouldHave = next.collectionIds.includes(collection.id);
        const has = members.includes(result.recipe.id);
        if (shouldHave && !has) {
          repos.collections.addRecipe(collection.id, result.recipe.id);
        } else if (!shouldHave && has) {
          repos.collections.removeRecipe(collection.id, result.recipe.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save draft');
    } finally {
      setSaving(false);
    }
  }, []);

  const queuePersist = useCallback(
    (next: EditorDraft) => {
      saveChainRef.current = saveChainRef.current.then(() => persist(next)).catch(() => undefined);
    },
    [persist],
  );

  const updateField = useCallback(
    <K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) => {
      setDraft((prev) => {
        const next = { ...prev, [key]: value };
        draftRef.current = next;
        if (readyRef.current) {
          queuePersist(next);
        }
        return next;
      });
    },
    [queuePersist],
  );

  const publish = useCallback(async () => {
    const autosave = autosaveRef.current;
    if (!autosave) return null;

    // Flush any pending draft using the known id, then publish.
    await saveChainRef.current;
    const current = draftRef.current;
    await persist(current);
    autosave.flushNow(recipeIdRef.current ?? undefined);

    const repos = getRepositories();
    const id = recipeIdRef.current;
    const tagIds = current.tagNames
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((name) => repos.tags.upsertByName(name).id);
    const servings = Number(current.servings);
    const patch = {
      title: current.title.trim() || 'Untitled recipe',
      notes: current.notes.trim() || null,
      sourceUrl: current.sourceUrl.trim() || null,
      servings: Number.isFinite(servings) && servings > 0 ? servings : null,
      prepMinutes: current.prepMinutes.trim() ? Number(current.prepMinutes) : null,
      cookMinutes: current.cookMinutes.trim() ? Number(current.cookMinutes) : null,
      ingredients: toIngredients(current.ingredientsText),
      instructions: toInstructions(current.instructionsText),
      tagIds,
      status: 'published' as const,
    };

    const published = id ? repos.recipes.update(id, patch) : repos.recipes.create(patch);

    recipeIdRef.current = published.id;
    setRecipeId(published.id);
    setStatus('published');
    setLastSavedAt(published.updatedAt);
    return published;
  }, [persist]);

  const softDelete = useCallback(() => {
    const id = recipeIdRef.current;
    if (!id) return;
    getRepositories().recipes.softDelete(id);
  }, []);

  return {
    draft,
    recipeId,
    status,
    saving,
    lastSavedAt,
    error,
    updateField,
    publish,
    softDelete,
  };
}
