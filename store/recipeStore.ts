import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedFolders, seedRecipes } from '../data/seedRecipes';
import { importRecipe, RecipeImportError } from '../services/import/importRecipe';
import { importRecipeFromImage } from '../services/import/importImage';
import { pullUserData, pushUserData, deleteRecipeRemote } from '../services/sync/recipeSync';
import {
  Folder,
  GroceryItem,
  ImportJob,
  Ingredient,
  MealPlanSlot,
  Recipe,
  RecipeDraft,
} from '../types/recipe';
import { aggregateIngredients } from '../services/grocery/aggregateIngredients';

interface RecipeStore {
  recipes: Recipe[];
  folders: Folder[];
  mealPlan: MealPlanSlot[];
  groceryCheckedIds: string[];
  currentImport: ImportJob | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => string;
  updateRecipe: (id: string, updates: Partial<Omit<Recipe, 'id' | 'createdAt'>>) => void;
  saveDraft: (draft: RecipeDraft) => string;
  updateDraft: (draft: RecipeDraft) => void;
  startImport: (input: string, suppliedText?: string) => Promise<RecipeDraft>;
  startImageImport: (imageUri: string, mimeType?: string) => Promise<RecipeDraft>;
  clearImport: () => void;
  deleteRecipe: (id: string) => void;
  toggleFolder: (recipeId: string, folderId: string) => void;
  addFolder: (name: string, emoji: string, color: string) => string;
  searchRecipes: (query: string) => Recipe[];
  getRecipesByFolder: (folderId: string) => Recipe[];
  setMealPlanRecipe: (dayIndex: number, recipeId: string | null) => void;
  getGroceryList: () => GroceryItem[];
  toggleGroceryItem: (id: string) => void;
  loadFromCloud: (userId: string) => Promise<boolean>;
  syncToCloud: (userId: string) => Promise<boolean>;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyMealPlan = (): MealPlanSlot[] =>
  Array.from({ length: 7 }, (_, dayIndex) => ({ dayIndex, recipeId: null }));

let syncTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleSync = (get: () => RecipeStore, userId?: string) => {
  if (!userId) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void get().syncToCloud(userId);
  }, 1200);
};

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
      recipes: seedRecipes,
      folders: seedFolders,
      mealPlan: emptyMealPlan(),
      groceryCheckedIds: [],
      currentImport: null,
      syncStatus: 'idle',

      addRecipe: (recipe) => {
        const duplicate = recipe.canonicalUrl
          ? get().recipes.find((item) => item.canonicalUrl === recipe.canonicalUrl)
          : undefined;
        if (duplicate) return duplicate.id;
        const id = uid();
        set((state) => ({
          recipes: [{ ...recipe, id, createdAt: new Date().toISOString() }, ...state.recipes],
        }));
        return id;
      },

      updateRecipe: (id, updates) => {
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === id ? { ...recipe, ...updates } : recipe,
          ),
        }));
      },

      saveDraft: (draft) => {
        const id = get().addRecipe({
          title: draft.title,
          description: draft.description,
          imageGradient: draft.imageGradient,
          imageUrl: draft.imageUrl,
          source: draft.source,
          sourceUrl: draft.sourceUrl,
          canonicalUrl: draft.canonicalUrl,
          sourceAttribution: draft.sourceAttribution,
          folderIds: [],
          prepTime: draft.prepTime,
          cookTime: draft.cookTime,
          servings: draft.servings,
          ingredients: draft.ingredients,
          steps: draft.steps,
          nutrition: draft.nutrition,
          tags: draft.tags,
        });
        set({ currentImport: null });
        return id;
      },

      updateDraft: (draft) =>
        set((state) => ({
          currentImport: state.currentImport
            ? { ...state.currentImport, draft, status: 'review' }
            : {
                id: uid(),
                input: draft.sourceUrl ?? '',
                status: 'review',
                draft,
              },
        })),

      startImport: async (input, suppliedText) => {
        const jobId = uid();
        set({
          currentImport: {
            id: jobId,
            input,
            status: 'resolving',
          },
        });
        try {
          set((state) => ({
            currentImport:
              state.currentImport?.id === jobId
                ? { ...state.currentImport, status: 'extracting' }
                : state.currentImport,
          }));
          const draft = await importRecipe(input, suppliedText);
          set((state) => ({
            currentImport:
              state.currentImport?.id === jobId
                ? { ...state.currentImport, status: 'review', draft }
                : state.currentImport,
          }));
          return draft;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Recipe import failed.';
          const needsInput =
            error instanceof RecipeImportError &&
            (error.code === 'needs_input' || error.code === 'backend_unavailable');
          set((state) => ({
            currentImport:
              state.currentImport?.id === jobId
                ? {
                    ...state.currentImport,
                    status: needsInput ? 'needs_input' : 'failed',
                    error: message,
                  }
                : state.currentImport,
          }));
          throw error;
        }
      },

      startImageImport: async (imageUri, mimeType) => {
        const jobId = uid();
        set({
          currentImport: {
            id: jobId,
            input: imageUri,
            status: 'extracting',
          },
        });
        try {
          const draft = await importRecipeFromImage(imageUri, mimeType);
          set((state) => ({
            currentImport:
              state.currentImport?.id === jobId
                ? { ...state.currentImport, status: 'review', draft }
                : state.currentImport,
          }));
          return draft;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Photo import failed.';
          set((state) => ({
            currentImport:
              state.currentImport?.id === jobId
                ? { ...state.currentImport, status: 'failed', error: message }
                : state.currentImport,
          }));
          throw error;
        }
      },

      clearImport: () => set({ currentImport: null }),

      deleteRecipe: (id) => {
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
          mealPlan: state.mealPlan.map((slot) =>
            slot.recipeId === id ? { ...slot, recipeId: null } : slot,
          ),
        }));
      },

      toggleFolder: (recipeId, folderId) =>
        set((state) => ({
          recipes: state.recipes.map((recipe) => {
            if (recipe.id !== recipeId) return recipe;
            const has = recipe.folderIds.includes(folderId);
            return {
              ...recipe,
              folderIds: has
                ? recipe.folderIds.filter((folder) => folder !== folderId)
                : [...recipe.folderIds, folderId],
            };
          }),
        })),

      addFolder: (name, emoji, color) => {
        const id = uid();
        set((state) => ({
          folders: [...state.folders, { id, name, emoji, color }],
        }));
        return id;
      },

      searchRecipes: (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return get().recipes;
        return get().recipes.filter(
          (recipe) =>
            recipe.title.toLowerCase().includes(q) ||
            recipe.tags.some((tag) => tag.includes(q)) ||
            recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(q)),
        );
      },

      getRecipesByFolder: (folderId) =>
        get().recipes.filter((recipe) => recipe.folderIds.includes(folderId)),

      setMealPlanRecipe: (dayIndex, recipeId) =>
        set((state) => ({
          mealPlan: state.mealPlan.map((slot) =>
            slot.dayIndex === dayIndex ? { ...slot, recipeId } : slot,
          ),
        })),

      getGroceryList: () => {
        const { mealPlan, recipes, groceryCheckedIds } = get();
        const planned = mealPlan
          .map((slot) => recipes.find((recipe) => recipe.id === slot.recipeId))
          .filter(Boolean) as Recipe[];
        const items = aggregateIngredients(
          planned.map((recipe) => ({ recipeId: recipe.id, ingredients: recipe.ingredients })),
        );
        return items.map((item) => ({
          ...item,
          checked: groceryCheckedIds.includes(item.id),
        }));
      },

      toggleGroceryItem: (id) =>
        set((state) => ({
          groceryCheckedIds: state.groceryCheckedIds.includes(id)
            ? state.groceryCheckedIds.filter((itemId) => itemId !== id)
            : [...state.groceryCheckedIds, id],
        })),

      loadFromCloud: async (userId) => {
        set({ syncStatus: 'syncing' });
        const data = await pullUserData(userId);
        if (!data) {
          set({ syncStatus: 'error' });
          return false;
        }
        set({
          recipes: data.recipes.length ? data.recipes : get().recipes,
          folders: data.folders.length ? data.folders : get().folders,
          mealPlan: data.mealPlan,
          groceryCheckedIds: data.groceryCheckedIds,
          syncStatus: 'idle',
        });
        return true;
      },

      syncToCloud: async (userId) => {
        set({ syncStatus: 'syncing' });
        const state = get();
        const ok = await pushUserData(userId, {
          recipes: state.recipes,
          folders: state.folders,
          mealPlan: state.mealPlan,
          groceryCheckedIds: state.groceryCheckedIds,
        });
        set({ syncStatus: ok ? 'idle' : 'error' });
        return ok;
      },
    }),
    {
      name: 'whisk-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recipes: state.recipes,
        folders: state.folders,
        mealPlan: state.mealPlan,
        groceryCheckedIds: state.groceryCheckedIds,
      }),
    },
  ),
);

export const scaleIngredient = (ingredient: Ingredient, factor: number): string => {
  const num = parseFloat(ingredient.amount);
  if (Number.isNaN(num)) return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`.trim();
  const scaled = Math.round(num * factor * 100) / 100;
  return `${scaled} ${ingredient.unit} ${ingredient.name}`.trim();
};

export { deleteRecipeRemote, scheduleSync };
