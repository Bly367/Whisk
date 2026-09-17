/**
 * P2-W1 sync & auth foundation — prefer importing from `@/data` in feature code.
 */
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
  useSyncStatusStore,
  reportLocalPersistSuccess,
  reportLocalPersistFailure,
  withLocalPersist,
  bannerStatusFromLocal,
} from '@/data/sync/statusStore';
