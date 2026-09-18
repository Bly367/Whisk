/**
 * P2-W7: web/desktop must not become domain SOT over mobile SQLite
 * without sync contracts from P2-W1 / P2-W2.
 */
export const WEB_DESKTOP_SOT_POLICY = {
  /** Web/desktop is never the domain library authority on its own. */
  isDomainSourceOfTruth: false as const,
  /** Capture + import preview relay only until sync lands. */
  role: 'capture_and_preview_relay' as const,
  /** Mobile on-device SQLite remains canonical for the user's library. */
  mobileSqliteRemainsCanonical: true as const,
  /** Must not claim a cloud-synced library from the web shell alone. */
  mayClaimCloudSyncedLibrary: false as const,
  /** Must not open / write the mobile SQLite file from web/desktop. */
  mayWriteMobileSqliteDirectly: false as const,
  /** Sync contracts required before any shared library SOT claim. */
  requiresSyncContractsFrom: ['P2-W1', 'P2-W2'] as const,
} as const;

export type WebDesktopSotPolicy = typeof WEB_DESKTOP_SOT_POLICY;
