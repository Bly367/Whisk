import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { RecipeImportErrorCode } from '../types/import';
import { RecipeSource } from '../types/recipe';

export const IMPORT_HISTORY_LIMIT = 25;

export interface ImportHistoryEntry {
  id: string;
  kind: 'url' | 'image';
  source: RecipeSource;
  timestamp: string;
  status: 'success' | 'failed';
  draftTitle?: string;
  errorCode?: RecipeImportErrorCode;
}

export function addBoundedImportHistory(
  history: ImportHistoryEntry[],
  entry: ImportHistoryEntry,
): ImportHistoryEntry[] {
  return [entry, ...history.filter((item) => item.id !== entry.id)].slice(
    0,
    IMPORT_HISTORY_LIMIT,
  );
}

interface ImportHistoryStore {
  history: ImportHistoryEntry[];
  recordImport: (entry: ImportHistoryEntry) => void;
  clearHistory: () => void;
}

export const useImportHistoryStore = create<ImportHistoryStore>()(
  persist(
    (set) => ({
      history: [],
      recordImport: (entry) =>
        set((state) => ({ history: addBoundedImportHistory(state.history, entry) })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'whisk-import-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ history: state.history }),
    },
  ),
);
