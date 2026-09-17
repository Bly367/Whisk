/**
 * Whisk data layer — SQLite source of truth + repository contracts for W3–W7.
 *
 * @example
 * import { getRepositories, useSyncStatusStore } from '@/data';
 * const { recipes } = getRepositories();
 */

export type * from '@/data/contracts';

export { createExpoDbClient, type DbClient, type SqlValue, type RunResult } from '@/data/client';
export {
  getDatabase,
  migrate,
  migrateDbIfNeeded,
  setDatabaseForTests,
} from '@/data/database';
export { DATABASE_NAME, MIGRATION_V1, SCHEMA_VERSION } from '@/data/schema';
export { createRecipeAutosave, type RecipeAutosave } from '@/data/autosave';
export { createOfflineReader, type OfflineReader } from '@/data/offline';
export {
  createRepositories,
  getRepositories,
  setRepositoriesForTests,
  createRecipeRepository,
  createTagRepository,
  createCollectionRepository,
  createMealPlanRepository,
  createGroceryRepository,
  type Repositories,
} from '@/data/repositories';
export {
  useSyncStatusStore,
  reportLocalPersistSuccess,
  reportLocalPersistFailure,
  bannerStatusFromLocal,
  type SyncStatusState,
} from '@/data/sync/statusStore';
export { createId, nowIso } from '@/data/util';
