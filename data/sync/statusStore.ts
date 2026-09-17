import type { SyncBannerStatus } from '@/data/contracts';
import { create } from 'zustand';

/**
 * UI/session store for sync banner presentation only.
 * Domain data lives in SQLite — do not put recipes/plans/lists here.
 *
 * Cloud `synced` is only set via `markRemoteSyncSucceeded`, which requires a
 * prior successful local persist (`lastLocalPersistAt`). Prefer
 * `markLocalPersisted` / `reportLocalPersist*` for local writes; do not call
 * `setStatus('synced')` (excluded from SettableSyncBannerStatus).
 */
export type SettableSyncBannerStatus = Exclude<SyncBannerStatus, 'synced'>;

export type SyncStatusState = {
  status: SyncBannerStatus;
  detail: string | null;
  lastLocalPersistAt: string | null;
  setStatus: (status: SettableSyncBannerStatus, detail?: string | null) => void;
  markLocalPersisted: () => void;
  markPersistFailed: (detail?: string) => void;
  markOffline: () => void;
  resetToLocalOk: () => void;
  /** After local persist — show syncing. No-op (needs_attention) if never persisted. */
  markRemoteSyncStarted: () => void;
  /** Cloud success only when local persist already succeeded. */
  markRemoteSyncSucceeded: () => void;
  markRemoteSyncFailed: (detail?: string) => void;
};

export const useSyncStatusStore = create<SyncStatusState>((set, get) => ({
  status: 'saved_locally',
  detail: null,
  lastLocalPersistAt: null,

  setStatus: (status, detail = null) => set({ status, detail }),

  markLocalPersisted: () =>
    set({
      status: 'saved_locally',
      detail: null,
      lastLocalPersistAt: new Date().toISOString(),
    }),

  markPersistFailed: (detail) =>
    set({
      status: 'needs_attention',
      detail: detail ?? 'Could not save on this device.',
    }),

  markOffline: () =>
    set({
      status: 'offline',
      detail: null,
    }),

  resetToLocalOk: () =>
    set({
      status: 'saved_locally',
      detail: null,
    }),

  markRemoteSyncStarted: () => {
    if (!get().lastLocalPersistAt) {
      set({
        status: 'needs_attention',
        detail: 'Cannot sync before saving on this device.',
      });
      return;
    }
    set({ status: 'syncing', detail: null });
  },

  markRemoteSyncSucceeded: () => {
    if (!get().lastLocalPersistAt) {
      set({
        status: 'needs_attention',
        detail: 'Cannot claim synced before local persistence.',
      });
      return;
    }
    set({ status: 'synced', detail: null });
  },

  markRemoteSyncFailed: (detail) =>
    set({
      status: 'needs_attention',
      detail: detail ?? 'Could not reach sync. Your edits are still on this device.',
    }),
}));

/** Imperative helpers for repositories / autosave (outside React). */
export function reportLocalPersistSuccess(): void {
  useSyncStatusStore.getState().markLocalPersisted();
}

export function reportLocalPersistFailure(detail?: string): void {
  useSyncStatusStore.getState().markPersistFailed(detail);
}

/**
 * Run a domain write and update the sync banner from the outcome.
 * Success is reported only after `fn` returns without throwing.
 */
export function withLocalPersist<T>(fn: () => T, failureDetail?: string): T {
  try {
    const result = fn();
    reportLocalPersistSuccess();
    return result;
  } catch (error) {
    reportLocalPersistFailure(
      error instanceof Error ? error.message : (failureDetail ?? 'Could not save on this device.'),
    );
    throw error;
  }
}

/**
 * Map local domain sync flags to banner status.
 * Never maps to cloud "synced" until a real cloud sync exists.
 */
export function bannerStatusFromLocal(
  local: 'synced_local' | 'pending' | 'needs_attention',
): SyncBannerStatus {
  switch (local) {
    case 'needs_attention':
      return 'needs_attention';
    case 'pending':
    case 'synced_local':
    default:
      return 'saved_locally';
  }
}
