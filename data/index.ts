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
  applySchemaV2Extensions,
} from '@/data/database';
export { DATABASE_NAME, MIGRATION_V1, MIGRATION_V2, SCHEMA_VERSION } from '@/data/schema';
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
  createHouseholdRepository,
  createPantryRepository,
  createMealPlanTemplateRepository,
  createLeftoversRepository,
  createCompatRepository,
  type Repositories,
} from '@/data/repositories';
export {
  useSyncStatusStore,
  reportLocalPersistSuccess,
  reportLocalPersistFailure,
  withLocalPersist,
  bannerStatusFromLocal,
  type SyncStatusState,
  type SettableSyncBannerStatus,
} from '@/data/sync/statusStore';
export type * from '@/data/sync/contracts';
export {
  SECURE_TOKEN_STORAGE_KEY,
  createSecureTokenStorage,
  createMemorySecureTokenStorage,
} from '@/data/sync/secureTokenStorage';
export {
  useAuthSessionStore,
  createStubAuthTransport,
  getAuthTokens,
} from '@/data/sync/authSession';
export {
  createSyncClient,
  createStubSyncTransport,
  reportSyncBlockedByLocalFailure,
} from '@/data/sync/syncClient';
export {
  GROCERY_CONFLICT_POLICY,
  resolveGroceryItemConflict,
  shouldApplyRemoteGroceryWrite,
} from '@/data/sync/groceryConflict';
export {
  createGroceryRealtimeHub,
  createInMemoryGroceryRealtimeTransport,
  type GroceryRealtimeEvent,
  type GroceryRealtimeHub,
  type GroceryRealtimeTransport,
  type GroceryRealtimeUnsubscribe,
} from '@/data/sync/groceryRealtime';
export {
  HouseholdAuthzError,
  createHouseholdCollaboration,
  generateInviteCode,
  normalizeInviteCode,
} from '@/features/household/collaboration';
export { createId, nowIso } from '@/data/util';
