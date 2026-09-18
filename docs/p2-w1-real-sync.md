# P2-W1 real sync + account-bound unlock

Phase 2 foundation is no longer stub-only. Auth, sync, household invite registry,
grocery realtime, and unlock entitlements share a **cloud backend** so two devices
can collaborate before Phase 3.

## Backends

| Mode | When | How |
| --- | --- | --- |
| **Process-shared** (default) | Tests, single Expo process | `createSharedCloudBackend()` / `getProcessSharedCloudBackend()` |
| **HTTP sync server** | Two phones / simulator + device | `npm run sync-server` + `EXPO_PUBLIC_WHISK_SYNC_URL` |

Production should migrate auth to a maintained SDK (Supabase Auth / Apple / Google)
with server tenancy per [`SECURITY.md`](../SECURITY.md) §6. The Whisk sync server
is the real replaceable transport behind the P2-W1 contracts until that lands.

## Contracts

- `AuthTransport` → `createCloudAuthTransport` / `createHttpAuthTransport`
- `SyncTransport` → `createCloudSyncTransport` / `createHttpSyncTransport`
- `GroceryRealtimeTransport` → cloud or HTTP poll (`/grocery/poll`)
- Entitlements → account-bound via `EntitlementClient` (local AsyncStorage is a cache)

## App wiring

- Boot: `useAuthSessionStore.hydrate()` in `app/_layout.tsx`
- Account: sign-in / sign-out on `app/profile.tsx`
- Household: `createHouseholdCollaboration(repos, householdCollaborationCloudOptions(...))`
- Unlock: `unlockWithPurchase(userId)` writes cloud entitlement when signed in; other devices restore on sign-in

## Guest / offline

Guest mode still works with the network off. Sync push/pull skips when there are no tokens; local SQLite remains SOT.
