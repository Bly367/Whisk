/**
 * Local-first persistence / sync-status contracts.
 * Feature and data layers should keep domain writes honest: celebrate only after
 * SQLite (via repositories) succeeds; Zustand must not fake persistence.
 */

export type SyncStatus = 'saved_locally' | 'syncing' | 'synced' | 'needs_attention';

export type LocalWriteResult = {
  persisted: boolean;
};

export type SyncAttempt = 'idle' | 'in_progress' | 'success' | 'failure';

/** Status immediately after a repository write attempt. */
export function statusAfterLocalWrite(result: LocalWriteResult): SyncStatus {
  return result.persisted ? 'saved_locally' : 'needs_attention';
}

/**
 * Never celebrate success before local persistence succeeds.
 * Sync completion is optional and must not override a failed local write.
 */
export function mayCelebrateSuccess(args: {
  localPersisted: boolean;
  syncComplete?: boolean;
}): boolean {
  if (!args.localPersisted) {
    return false;
  }
  return true;
}

/** Derive banner status from local write + optional background sync. */
export function resolveSyncStatus(args: {
  localPersisted: boolean;
  sync: SyncAttempt;
}): SyncStatus {
  if (!args.localPersisted) {
    return 'needs_attention';
  }
  switch (args.sync) {
    case 'in_progress':
      return 'syncing';
    case 'success':
      return 'synced';
    case 'failure':
      return 'needs_attention';
    case 'idle':
      return 'saved_locally';
    default: {
      const _exhaustive: never = args.sync;
      return _exhaustive;
    }
  }
}

/**
 * Domain writes must go through repositories → SQLite.
 * Rejects UI/session stores as a write path for recipes/plans/lists.
 */
export function assertDomainWritePath(path: 'repository' | 'zustand' | 'ad_hoc_sqlite'): void {
  if (path !== 'repository') {
    throw new Error(`Invalid domain write path "${path}". Use typed repositories → SQLite only.`);
  }
}
