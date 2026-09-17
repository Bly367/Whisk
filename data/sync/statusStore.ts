import type { SyncBannerStatus } from '@/data/contracts';
import { create } from 'zustand';

/**
 * UI/session store for sync banner presentation only.
 * Domain data lives in SQLite — do not put recipes/plans/lists here.
 *
 * Cloud `synced` is reserved until real sync ships. Prefer
 * `markLocalPersisted` / `reportLocalPersist*` — do not call `setStatus('synced')`.
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
};

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
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
      error instanceof Error
        ? error.message
        : (failureDetail ?? 'Could not save on this device.'),
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
