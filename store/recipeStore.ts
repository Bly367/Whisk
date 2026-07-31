import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createInitialRecipeData, withoutSeedRecipes } from '../data/initialRecipeData';
import { importRecipe, RecipeImportError } from '../services/import/importRecipe';
import { importRecipeFromImage } from '../services/import/importImage';
import { detectSource } from '../services/import/url';
import { normalizeMealPlan } from '../services/mealPlan/dates';
import {
  CloudUserData,
  pullUserData,
  pushUserData,
} from '../services/sync/recipeSync';
import { mergeCloudData as mergeCloudSnapshot } from '../services/sync/merge';
import { useImportHistoryStore } from './importHistoryStore';
import {
  Folder,
  FolderTombstone,
  GroceryItem,
  ImportJob,
  Ingredient,
  MealPlanSlot,
  MealType,
  Recipe,
  RecipeDraft,
  RecipeTombstone,
} from '../types/recipe';
import { aggregateIngredients } from '../services/grocery/aggregateIngredients';
import { analytics } from '../services/observability/analytics';

interface RecipeStore {
  recipes: Recipe[];
  recipeTombstones: RecipeTombstone[];
  folders: Folder[];
  folderTombstones: FolderTombstone[];
  mealPlan: MealPlanSlot[];
  mealPlanUpdatedAt: string;
  groceryCheckedIds: string[];
  manualGroceryItems: GroceryItem[];
  groceryUpdatedAt: string;
  currentImport: ImportJob | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncUserId: string | null;
  syncPending: boolean;
  syncRevision: number;
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
  updateFolder: (id: string, updates: Pick<Folder, 'name' | 'emoji' | 'color'>) => void;
  deleteFolder: (id: string) => void;
  searchRecipes: (query: string) => Recipe[];
  getRecipesByFolder: (folderId: string) => Recipe[];
  setMealPlanRecipe: (
    date: string,
    mealType: MealType,
    recipeId: string,
    servings?: number,
  ) => void;
  removeMealPlanRecipe: (date: string, mealType: MealType) => void;
  getGroceryList: () => GroceryItem[];
  toggleGroceryItem: (id: string) => void;
  addManualGroceryItem: (name: string, amount?: string, unit?: string) => string;
  deleteManualGroceryItem: (id: string) => void;
  connectSync: (userId: string | null) => Promise<boolean>;
  loadFromCloud: (userId: string) => Promise<boolean>;
  syncToCloud: (userId: string) => Promise<boolean>;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyMealPlan = (): MealPlanSlot[] => [];

const demoDataEnabled =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_ENABLE_DEMO_DATA === 'true';
const initialRecipeData = createInitialRecipeData({
  isDevelopment: typeof __DEV__ !== 'undefined' && __DEV__,
  enableDemoData: process.env.EXPO_PUBLIC_ENABLE_DEMO_DATA,
});

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<boolean> | null = null;

const scheduleSync = (get: () => RecipeStore, userId = get().syncUserId ?? undefined) => {
  if (!userId) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void get().syncToCloud(userId);
  }, 1200);
};

const timestamp = () => new Date().toISOString();

function mergeCloudData(state: RecipeStore, cloud: CloudUserData) {
  return mergeCloudSnapshot(
    {
      recipes: state.recipes,
      recipeTombstones: state.recipeTombstones,
      folders: state.folders,
      folderTombstones: state.folderTombstones,
      mealPlan: state.mealPlan,
      mealPlanUpdatedAt: state.mealPlanUpdatedAt,
      groceryCheckedIds: state.groceryCheckedIds,
      manualGroceryItems: state.manualGroceryItems,
      groceryUpdatedAt: state.groceryUpdatedAt,
    },
    cloud,
  );
}

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
      recipes: initialRecipeData.recipes,
      recipeTombstones: [],
      folders: initialRecipeData.folders,
      folderTombstones: [],
      mealPlan: emptyMealPlan(),
      mealPlanUpdatedAt: timestamp(),
      groceryCheckedIds: [],
      manualGroceryItems: [],
      groceryUpdatedAt: timestamp(),
      currentImport: null,
      syncStatus: 'idle',
      syncUserId: null,
      syncPending: false,
      syncRevision: 0,

      addRecipe: (recipe) => {
        const duplicate = recipe.canonicalUrl
          ? get().recipes.find((item) => item.canonicalUrl === recipe.canonicalUrl)
          : undefined;
        if (duplicate) return duplicate.id;
        const id = uid();
        const updatedAt = timestamp();
        set((state) => ({
          recipes: [{ ...recipe, id, createdAt: updatedAt, updatedAt }, ...state.recipes],
          recipeTombstones: state.recipeTombstones.filter((item) => item.id !== id),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
        return id;
      },

      updateRecipe: (id, updates) => {
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === id ? { ...recipe, ...updates, updatedAt: timestamp() } : recipe,
          ),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
      },

      saveDraft: (draft) => {
        const id = get().addRecipe({
          title: draft.title,
          description: draft.description,
          imageGradient: draft.imageGradient,
          imageUrl: draft.imageUrl,
          imageStoragePath: draft.imageStoragePath,
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
          useImportHistoryStore.getState().recordImport({
            id: jobId,
            kind: 'url',
            source: draft.source,
            timestamp: new Date().toISOString(),
            status: 'success',
            draftTitle: draft.title,
          });
          set((state) => ({
            currentImport:
              state.currentImport?.id === jobId
                ? { ...state.currentImport, status: 'review', draft }
                : state.currentImport,
          }));
          return draft;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Recipe import failed.';
          const errorCode = error instanceof RecipeImportError ? error.code : 'network';
          const needsInput =
            error instanceof RecipeImportError &&
            (error.code === 'needs_input' || error.code === 'backend_unavailable');
          let source: RecipeDraft['source'] = 'url';
          try {
            source = detectSource(input);
          } catch {
            // Invalid inputs are represented by the safe generic URL source.
          }
          useImportHistoryStore.getState().recordImport({
            id: jobId,
            kind: 'url',
            source,
            timestamp: new Date().toISOString(),
            status: 'failed',
            errorCode,
          });
          set((state) => ({
            currentImport:
              state.currentImport?.id === jobId
                ? {
                    ...state.currentImport,
                    status: needsInput ? 'needs_input' : 'failed',
                    error: message,
                    errorCode,
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
          useImportHistoryStore.getState().recordImport({
            id: jobId,
            kind: 'image',
            source: 'photo',
            timestamp: new Date().toISOString(),
            status: 'success',
            draftTitle: draft.title,
          });
          set((state) => ({
            currentImport:
              state.currentImport?.id === jobId
                ? { ...state.currentImport, status: 'review', draft }
                : state.currentImport,
          }));
          return draft;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Photo import failed.';
          const errorCode = error instanceof RecipeImportError ? error.code : 'network';
          useImportHistoryStore.getState().recordImport({
            id: jobId,
            kind: 'image',
            source: 'photo',
            timestamp: new Date().toISOString(),
            status: 'failed',
            errorCode,
          });
          set((state) => ({
            currentImport:
              state.currentImport?.id === jobId
                ? { ...state.currentImport, status: 'failed', error: message, errorCode }
                : state.currentImport,
          }));
          throw error;
        }
      },

      clearImport: () => set({ currentImport: null }),

      deleteRecipe: (id) => {
        const deletedAt = timestamp();
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
          recipeTombstones: [
            ...state.recipeTombstones.filter((item) => item.id !== id),
            { id, deletedAt },
          ],
          mealPlan: state.mealPlan.filter((slot) => slot.recipeId !== id),
          mealPlanUpdatedAt: deletedAt,
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
      },

      toggleFolder: (recipeId, folderId) => {
        set((state) => ({
          recipes: state.recipes.map((recipe) => {
            if (recipe.id !== recipeId) return recipe;
            const has = recipe.folderIds.includes(folderId);
            return {
              ...recipe,
              folderIds: has
                ? recipe.folderIds.filter((folder) => folder !== folderId)
                : [...recipe.folderIds, folderId],
              updatedAt: timestamp(),
            };
          }),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
      },

      addFolder: (name, emoji, color) => {
        const id = uid();
        const updatedAt = timestamp();
        set((state) => ({
          folders: [...state.folders, { id, name, emoji, color, updatedAt }],
          folderTombstones: state.folderTombstones.filter((item) => item.id !== id),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
        return id;
      },

      updateFolder: (id, updates) => {
        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === id ? { ...folder, ...updates, updatedAt: timestamp() } : folder,
          ),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
      },

      deleteFolder: (id) => {
        const deletedAt = timestamp();
        set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== id),
          folderTombstones: [
            ...state.folderTombstones.filter((item) => item.id !== id),
            { id, deletedAt },
          ],
          recipes: state.recipes.map((recipe) =>
            recipe.folderIds.includes(id)
              ? {
                  ...recipe,
                  folderIds: recipe.folderIds.filter((folderId) => folderId !== id),
                  updatedAt: deletedAt,
                }
              : recipe,
          ),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
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

      setMealPlanRecipe: (date, mealType, recipeId, servings = 1) => {
        const slotId = `${date}-${mealType}`;
        set((state) => {
          const slot: MealPlanSlot = {
            id: slotId,
            date,
            mealType,
            recipeId,
            servings: Math.max(1, servings),
          };
          const exists = state.mealPlan.some((item) => item.id === slotId);
          return {
            mealPlan: exists
              ? state.mealPlan.map((item) => (item.id === slotId ? slot : item))
              : [...state.mealPlan, slot],
            mealPlanUpdatedAt: timestamp(),
            syncPending: true,
            syncRevision: state.syncRevision + 1,
          };
        });
        scheduleSync(get);
      },

      removeMealPlanRecipe: (date, mealType) => {
        const slotId = `${date}-${mealType}`;
        set((state) => ({
          mealPlan: state.mealPlan.filter((slot) => slot.id !== slotId),
          mealPlanUpdatedAt: timestamp(),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
      },

      getGroceryList: () => {
        const { mealPlan, recipes, groceryCheckedIds, manualGroceryItems } = get();
        const planned = mealPlan.flatMap((slot) => {
          const recipe = recipes.find((item) => item.id === slot.recipeId);
          if (!recipe) return [];
          return [{
            recipeId: recipe.id,
            ingredients: recipe.ingredients,
            factor: slot.servings / Math.max(1, recipe.servings),
          }];
        });
        const items = aggregateIngredients(
          planned,
        );
        const generated = items.map((item) => ({
          ...item,
          checked: groceryCheckedIds.includes(item.id),
        }));
        const manual = manualGroceryItems.map((item) => ({
          ...item,
          checked: groceryCheckedIds.includes(item.id),
        }));
        return [...manual, ...generated].sort((a, b) => a.name.localeCompare(b.name));
      },

      toggleGroceryItem: (id) => {
        set((state) => ({
          groceryCheckedIds: state.groceryCheckedIds.includes(id)
            ? state.groceryCheckedIds.filter((itemId) => itemId !== id)
            : [...state.groceryCheckedIds, id],
          groceryUpdatedAt: timestamp(),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
      },

      addManualGroceryItem: (name, amount = '', unit = '') => {
        const id = `manual-${uid()}`;
        set((state) => ({
          manualGroceryItems: [
            ...state.manualGroceryItems,
            { id, name: name.trim(), amount, unit, checked: false, recipeIds: [] },
          ],
          groceryUpdatedAt: timestamp(),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
        return id;
      },

      deleteManualGroceryItem: (id) => {
        set((state) => ({
          manualGroceryItems: state.manualGroceryItems.filter((item) => item.id !== id),
          groceryCheckedIds: state.groceryCheckedIds.filter((itemId) => itemId !== id),
          groceryUpdatedAt: timestamp(),
          syncPending: true,
          syncRevision: state.syncRevision + 1,
        }));
        scheduleSync(get);
      },

      connectSync: async (userId) => {
        if (syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        set({ syncUserId: userId, syncStatus: 'idle' });
        if (!userId) return true;
        return get().syncToCloud(userId);
      },

      loadFromCloud: async (userId) => get().syncToCloud(userId),

      syncToCloud: async (userId) => {
        if (syncInFlight) return syncInFlight;

        syncInFlight = (async () => {
          set({ syncStatus: 'syncing', syncUserId: userId });
          const cloud = await pullUserData(userId);
          if (!cloud) {
            set({ syncStatus: 'error', syncPending: true });
            return false;
          }

          const merged = mergeCloudData(get(), cloud);
          set(merged);
          const revision = get().syncRevision;
          const state = get();
          const ok = await pushUserData(userId, {
            recipes: withoutSeedRecipes(state.recipes),
            recipeTombstones: state.recipeTombstones,
            folders: state.folders,
            folderTombstones: state.folderTombstones,
            mealPlan: state.mealPlan,
            mealPlanUpdatedAt: state.mealPlanUpdatedAt,
            groceryCheckedIds: state.groceryCheckedIds,
            manualGroceryItems: state.manualGroceryItems,
            groceryUpdatedAt: state.groceryUpdatedAt,
          });

          const changedDuringSync = get().syncRevision !== revision;
          set({
            syncStatus: ok ? 'idle' : 'error',
            syncPending: !ok || changedDuringSync,
          });
          analytics.track(ok ? 'sync_succeeded' : 'sync_failed', {
            pending: !ok || changedDuringSync,
          });
          if (ok && changedDuringSync) scheduleSync(get, userId);
          return ok;
        })();

        try {
          return await syncInFlight;
        } finally {
          syncInFlight = null;
        }
      },
    }),
    {
      name: 'whisk-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recipes: state.recipes,
        recipeTombstones: state.recipeTombstones,
        folders: state.folders,
        folderTombstones: state.folderTombstones,
        mealPlan: state.mealPlan,
        mealPlanUpdatedAt: state.mealPlanUpdatedAt,
        groceryCheckedIds: state.groceryCheckedIds,
        manualGroceryItems: state.manualGroceryItems,
        groceryUpdatedAt: state.groceryUpdatedAt,
        syncPending: state.syncPending,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<RecipeStore>;
        const recipes = persisted.recipes ?? currentState.recipes;

        return {
          ...currentState,
          ...persisted,
          recipes: demoDataEnabled ? recipes : withoutSeedRecipes(recipes),
          mealPlan: normalizeMealPlan(persisted.mealPlan ?? currentState.mealPlan),
        };
      },
    },
  ),
);

export const scaleIngredient = (ingredient: Ingredient, factor: number): string => {
  const num = parseFloat(ingredient.amount);
  if (Number.isNaN(num)) return `${ingredient.amount} ${ingredient.unit} ${ingredient.name}`.trim();
  const scaled = Math.round(num * factor * 100) / 100;
  return `${scaled} ${ingredient.unit} ${ingredient.name}`.trim();
};

export { scheduleSync };
