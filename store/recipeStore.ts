import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedFolders, seedRecipes } from '../data/seedRecipes';
import { importRecipe, RecipeImportError } from '../services/import/importRecipe';
import { Folder, ImportJob, Ingredient, Recipe, RecipeDraft } from '../types/recipe';

interface RecipeStore {
  recipes: Recipe[];
  folders: Folder[];
  currentImport: ImportJob | null;
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => string;
  saveDraft: (draft: RecipeDraft) => string;
  updateDraft: (draft: RecipeDraft) => void;
  startImport: (input: string, suppliedText?: string) => Promise<RecipeDraft>;
  clearImport: () => void;
  deleteRecipe: (id: string) => void;
  toggleFolder: (recipeId: string, folderId: string) => void;
  addFolder: (name: string, emoji: string, color: string) => string;
  searchRecipes: (query: string) => Recipe[];
  getRecipesByFolder: (folderId: string) => Recipe[];
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
      recipes: seedRecipes,
      folders: seedFolders,
      currentImport: null,

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

      clearImport: () => set({ currentImport: null }),

      deleteRecipe: (id) =>
        set((state) => ({ recipes: state.recipes.filter((r) => r.id !== id) })),

      toggleFolder: (recipeId, folderId) =>
        set((state) => ({
          recipes: state.recipes.map((r) => {
            if (r.id !== recipeId) return r;
            const has = r.folderIds.includes(folderId);
            return {
              ...r,
              folderIds: has
                ? r.folderIds.filter((f) => f !== folderId)
                : [...r.folderIds, folderId],
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
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.tags.some((t) => t.includes(q)) ||
            r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
        );
      },

      getRecipesByFolder: (folderId) =>
        get().recipes.filter((r) => r.folderIds.includes(folderId)),

    }),
    {
      name: 'whisk-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recipes: state.recipes,
        folders: state.folders,
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
