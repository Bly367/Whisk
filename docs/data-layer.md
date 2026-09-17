# Data layer contracts (W2)

Feature workstreams (W3–W7) should import domain types and repositories from `@/data` — not redefine schemas or open SQLite ad hoc.

## Source of truth

| Concern | Location |
| --- | --- |
| SQLite (recipes, plans, lists, trash) | `@/data` repositories |
| UI / session (sync banner, sheets) | Zustand — `useSyncStatusStore` only for sync chrome today |
| Never | Zustand as a recipe/plan/list database |

## Import paths

```ts
import {
  // contracts
  type Recipe,
  type RecipeWithIngredients,
  type RecipeListItem,
  type MealPlanWithEntries,
  type GroceryListWithItems,
  type LocalSyncStatus,
  // runtime
  getRepositories,
  createRecipeAutosave,
  createOfflineReader,
  useSyncStatusStore,
} from '@/data';
```

| Workstream | Primary contracts / APIs |
| --- | --- |
| **W3 Recipes** | `Recipe`, `RecipeCreateInput`, `RecipeUpdateInput`, `RecipeListQuery`, `getRepositories().recipes`, `createRecipeAutosave` |
| **W4 Import** | `RecipeCreateInput`, `IngredientInput`, `getRepositories().recipes.create` (after preview commit) |
| **W5 Plan** | `MealPlan`, `MealPlanEntry`, `MealSlot`, `getRepositories().mealPlans` |
| **W6 Shop** | `GroceryList`, `GroceryItem`, `getRepositories().grocery` |
| **W7 Cook + trust** | `RecipeWithIngredients`, `CookStep`, offline `getRecipe`; trash via `recipes.restore` |

## Key modules

- `data/contracts.ts` — shared TypeScript types
- `data/schema.ts` — SQLite DDL + `SCHEMA_VERSION`
- `data/repositories/*` — typed CRUD (only write path for domain data)
- `data/autosave.ts` — draft persistence (survives backgrounding conceptually)
- `data/offline.ts` — offline read helpers
- `data/sync/statusStore.ts` — banner status (`saved_locally` / `needs_attention` / …); **no fake cloud “synced”**

## Persistence rules

1. Celebrate success only after local SQLite write succeeds.
2. Soft-delete recipes (`deleted_at`) + `restore` for trash recovery.
3. List screens use `recipes.list()` which batches ingredient/tag names (no N+1).
