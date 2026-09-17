# Data layer contracts (W2)

Feature workstreams (W3–W7) should import domain types and repositories from `@/data` — not redefine schemas or open SQLite ad hoc.

## Source of truth

| Concern                               | Location                                                  |
| ------------------------------------- | --------------------------------------------------------- |
| SQLite (recipes, plans, lists, trash) | `@/data` repositories                                     |
| UI / session (sync banner, sheets)    | Zustand — `useSyncStatusStore` for sync chrome            |
| Auth tokens (Phase 2)                 | `expo-secure-store` via `createSecureTokenStorage` — never AsyncStorage |
| Never                                 | Zustand as a recipe/plan/list database                    |
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

| Workstream          | Primary contracts / APIs                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **W3 Recipes**      | `Recipe`, `RecipeCreateInput`, `RecipeUpdateInput`, `RecipeListQuery`, `getRepositories().recipes`, `createRecipeAutosave` |
| **W4 Import**       | `RecipeCreateInput`, `IngredientInput`, `getRepositories().recipes.create` (after preview commit)                          |
| **W5 Plan**         | `MealPlan`, `MealPlanEntry`, `MealSlot`, `getRepositories().mealPlans`                                                     |
| **W6 Shop**         | `GroceryList`, `GroceryItem`, `getRepositories().grocery`                                                                  |
| **W7 Cook + trust** | `RecipeWithIngredients`, `CookStep`, offline `getRecipe`; trash via `recipes.restore`                                      |

## Key modules

- `data/contracts.ts` — shared TypeScript types (`SyncBannerStatus`, domain models)
- `data/schema.ts` — SQLite DDL + `SCHEMA_VERSION`
- `data/repositories/*` — typed CRUD (only write path for domain data)
- `data/autosave.ts` — draft persistence (survives backgrounding conceptually)
- `data/offline.ts` — offline read helpers
- `data/sync/statusStore.ts` — banner status; cloud `synced` only via `markRemoteSyncSucceeded` after local persist
- `data/sync/contracts.ts` — P2-W1 auth/sync transport contracts for later workstreams
- `data/sync/secureTokenStorage.ts` — secure token storage (not AsyncStorage)
- `data/sync/authSession.ts` — optional sign-in / sign-out; guest remains default
- `data/sync/syncClient.ts` — sync client + stub transport (`createStubSyncTransport`)
- `data/DatabaseProvider.tsx` — boots SQLite, runs migrations, caches the write connection

## Database connection

`DatabaseProvider` (`SQLiteProvider` + `migrateDbIfNeeded`) opens the DB on boot, migrates, and **caches that client**. `getDatabase()` / `getRepositories()` reuse it. Repositories own all domain writes; do not open a second database for feature code.

## Persistence rules

1. Celebrate success only after local SQLite write succeeds (`withLocalPersist` / `reportLocalPersist*` on mutating APIs).
2. Soft-delete recipes (`deleted_at`) + `restore` for trash recovery.
3. List screens use `recipes.list()` which batches ingredient/tag names (no N+1).
4. Do not call `setStatus('synced')` — use `markLocalPersisted`, then `markRemoteSyncSucceeded` only after a real remote success (requires `lastLocalPersistAt`).
5. Autosave without `recipeId` reuses the session’s first anonymous draft id (no duplicate drafts).
6. Auth tokens go through `SecureTokenStorage` only; guest/local core loop must work with network off and without an account.
