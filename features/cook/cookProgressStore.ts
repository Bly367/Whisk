import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'whisk.cookProgress.v1';

export type CookProgress = {
  recipeId: string;
  stepIndex: number;
  updatedAt: string;
};

type CookProgressState = {
  byRecipeId: Record<string, CookProgress>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  getProgress: (recipeId: string) => CookProgress | null;
  setStep: (recipeId: string, stepIndex: number) => Promise<void>;
  clearProgress: (recipeId: string) => Promise<void>;
  /** Test helper — bypass AsyncStorage. */
  replaceAllForTests: (byRecipeId: Record<string, CookProgress>) => void;
};

async function persist(byRecipeId: Record<string, CookProgress>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byRecipeId));
}

export const useCookProgressStore = create<CookProgressState>((set, get) => ({
  byRecipeId: {},
  hydrated: false,

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CookProgress>;
        set({ byRecipeId: parsed ?? {}, hydrated: true });
        return;
      }
    } catch {
      // Ignore corrupt storage; cook mode still starts at step 0.
    }
    set({ hydrated: true });
  },

  getProgress(recipeId) {
    return get().byRecipeId[recipeId] ?? null;
  },

  async setStep(recipeId, stepIndex) {
    const next: Record<string, CookProgress> = {
      ...get().byRecipeId,
      [recipeId]: {
        recipeId,
        stepIndex,
        updatedAt: new Date().toISOString(),
      },
    };
    set({ byRecipeId: next });
    await persist(next);
  },

  async clearProgress(recipeId) {
    const next = { ...get().byRecipeId };
    delete next[recipeId];
    set({ byRecipeId: next });
    await persist(next);
  },

  replaceAllForTests(byRecipeId) {
    set({ byRecipeId, hydrated: true });
  },
}));
