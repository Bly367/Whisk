# Data layer contracts (W2 + P2-W2)

Feature workstreams (W3–W7 / P2-W3–W6) should import domain types and repositories from `@/data` — not redefine schemas or open SQLite ad hoc.

## Source of truth

| Concern                               | Location                                                  |
| ------------------------------------- | --------------------------------------------------------- |
| SQLite (recipes, plans, lists, trash) | `@/data` repositories                                     |
| Phase 2 extensions (household, pantry, templates, leftovers, compat) | `@/data` repositories (`households`, `pantry`, `templates`, `leftovers`, `compat`) |
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
  type HouseholdWithMembers,
  type PantryItem,
  type MealPlanTemplateWithEntries,
  type LeftoversLink,
  type CompatImportJob,
  type CompatExportPack,
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
| **P2-W3 Household** | `Household`, `HouseholdMember`, `getRepositories().households`, `createHouseholdCollaboration`, `createGroceryRealtimeHub`, `GROCERY_CONFLICT_POLICY` |
| **P2-W4 Pantry**    | `PantryItem`, `PantryListQuery`, `getRepositories().pantry`                                                                |
| **P2-W5 Templates** | `MealPlanTemplate`, `LeftoversLink`, `getRepositories().templates` / `.leftovers`                                          |
| **P2-W6 Compat**    | `CompatImportJob`, `CompatExportPack`, `getRepositories().compat` (parsers land in P2-W6)                                  |

## Key modules

- `data/contracts.ts` — shared TypeScript types (`SyncBannerStatus`, domain models, P2-W2 models)
- `data/schema.ts` — SQLite DDL + `SCHEMA_VERSION` (v2 = Phase 2 extensions)
- `data/repositories/*` — typed CRUD (only write path for domain data)
- `data/autosave.ts` — draft persistence (survives backgrounding conceptually)
- `data/offline.ts` — offline read helpers
- `data/sync/statusStore.ts` — banner status; cloud `synced` only via `markRemoteSyncSucceeded` after local persist
- `data/sync/contracts.ts` — P2-W1 auth/sync transport contracts for later workstreams
- `data/sync/secureTokenStorage.ts` — secure token storage (not AsyncStorage)
- `data/sync/authSession.ts` — optional sign-in / sign-out; guest remains default
- `data/sync/syncClient.ts` — sync client + stub transport (`createStubSyncTransport`)
- `data/sync/groceryConflict.ts` — P2-W3 LWW conflict policy for grocery items
- `data/sync/groceryRealtime.ts` — membership-gated realtime grocery hub + in-memory transport
- `features/household/collaboration.ts` — invite/join + shared-list authz (`HouseholdAuthzError`)
- `docs/household-collab.md` — invite/join, authz, realtime, conflict policy
- `data/DatabaseProvider.tsx` — boots SQLite, runs migrations, caches the write connection

## Database connection

`DatabaseProvider` (`SQLiteProvider` + `migrateDbIfNeeded`) opens the DB on boot, migrates, and **caches that client**. `getDatabase()` / `getRepositories()` reuse it. Repositories own all domain writes; do not open a second database for feature code.

Schema upgrades: empty DB runs `MIGRATION_V1` then `MIGRATION_V2`; MVP installs at `user_version = 1` apply only `MIGRATION_V2` (plus tenant columns `household_id` / `remote_id` on recipes, meal_plans, grocery_lists). Migrations are idempotent via `user_version` and `CREATE … IF NOT EXISTS`.

## Persistence rules

1. Celebrate success only after local SQLite write succeeds (`withLocalPersist` / `reportLocalPersist*` on mutating APIs).
2. Soft-delete recipes (`deleted_at`) + `restore` for trash recovery.
3. List screens use `recipes.list()` which batches ingredient/tag names (no N+1).
4. Do not call `setStatus('synced')` — use `markLocalPersisted`, then `markRemoteSyncSucceeded` only after a real remote success (requires `lastLocalPersistAt`).
5. Autosave without `recipeId` reuses the session’s first anonymous draft id (no duplicate drafts).
6. Auth tokens go through `SecureTokenStorage` only; guest/local core loop must work with network off and without an account.
7. Phase 2 rows keep stable local `id`s and optional `remote_id` / `household_id` for sync tenancy (P2-W3+).
