import { create } from 'zustand';

import type { SyncBannerStatus } from '@/data/contracts';

/**
 * UI/session store for sync banner presentation only.
 * Domain data lives in SQLite — do not put recipes/plans/lists here.
 */
export type SyncStatusState = {
  status: SyncBannerStatus;
  detail: string | null;
  lastLocalPersistAt: string | null;
  setStatus: (status: SyncBannerStatus, detail?: string | null) => void;
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
