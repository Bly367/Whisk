import { create } from 'zustand';

import type { ImportAdapterError, ImportDraft } from '@/import/types';

type ImportPhase = 'idle' | 'importing' | 'preview' | 'failed' | 'saving' | 'saved';

type ImportSessionState = {
  phase: ImportPhase;
  draft: ImportDraft | null;
  error: ImportAdapterError | null;
  savedRecipeId: string | null;
  savedDraftIds: Set<string>;
  setImporting: () => void;
  setPreview: (draft: ImportDraft) => void;
  patchDraft: (patch: Partial<ImportDraft>) => void;
  setFailed: (error: ImportAdapterError) => void;
  setSaving: () => void;
  setSaved: (recipeId: string, draftId: string) => void;
  clear: () => void;
};

/**
 * Ephemeral import UI session (Zustand).
 * SQLite remains source of truth — drafts here are never celebrated as saved.
 */
export const useImportSessionStore = create<ImportSessionState>((set, get) => ({
  phase: 'idle',
  draft: null,
  error: null,
  savedRecipeId: null,
  savedDraftIds: new Set(),

  setImporting: () => set({ phase: 'importing', error: null, savedRecipeId: null }),

  setPreview: (draft) => set({ phase: 'preview', draft, error: null, savedRecipeId: null }),

  patchDraft: (patch) => {
    const current = get().draft;
    if (!current) return;
    set({ draft: { ...current, ...patch } });
  },

  setFailed: (error) => set({ phase: 'failed', error, draft: null, savedRecipeId: null }),

  setSaving: () => set({ phase: 'saving' }),

  setSaved: (recipeId, draftId) => {
    const savedDraftIds = new Set(get().savedDraftIds);
    savedDraftIds.add(draftId);
    set({
      phase: 'saved',
      savedRecipeId: recipeId,
      savedDraftIds,
      error: null,
    });
  },

  clear: () =>
    set({
      phase: 'idle',
      draft: null,
      error: null,
      savedRecipeId: null,
      // Keep savedDraftIds across clears in-session to block duplicate commits.
    }),
}));
