import { useEffect } from 'react';

import {
  createGroceryRealtimeHub,
  createHouseholdCollaboration,
  createInMemoryGroceryRealtimeTransport,
  getRepositories,
  type GroceryRealtimeEvent,
  type GroceryRealtimeUnsubscribe,
} from '@/data';
import { getAuthTokens, useAuthSessionStore } from '@/data/sync/authSession';

/** Process-wide in-memory bus so local multi-client tests / same-app peers can share events. */
const sharedTransport = createInMemoryGroceryRealtimeTransport();

/**
 * Subscribe to household grocery realtime when the active list is tenant-scoped
 * and the signed-in user is an active member. Applies events into local SQLite,
 * then invokes `onApplied` so Shop can refresh.
 */
export function useHouseholdGrocerySync(input: {
  listId: string | null;
  householdId: string | null;
  onApplied: () => void;
}): void {
  const userId = useAuthSessionStore((s) => s.identity?.user.id ?? null);
  const mode = useAuthSessionStore((s) => s.mode);
  const { listId, householdId, onApplied } = input;

  useEffect(() => {
    if (mode !== 'signed_in' || !userId || !householdId || !listId) {
      return;
    }

    let cancelled = false;
    let unsubscribe: GroceryRealtimeUnsubscribe | null = null;

    void (async () => {
      try {
        const repos = getRepositories();
        const collab = createHouseholdCollaboration(repos);
        if (!collab.isActiveMember(householdId, userId)) {
          return;
        }
        const tokens = await getAuthTokens();
        if (!tokens || cancelled) {
          return;
        }
        const hub = createGroceryRealtimeHub({
          transport: sharedTransport,
          collaboration: collab,
          grocery: repos.grocery,
        });
        unsubscribe = await hub.subscribe({
          householdId,
          userId,
          tokens,
          onEvent: (event: GroceryRealtimeEvent) => {
            const result = hub.applyEvent(event);
            if (result.applied) {
              onApplied();
            }
          },
        });
      } catch {
        // Authz / missing tokens — guest and offline shop still work without realtime.
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [mode, userId, householdId, listId, onApplied]);
}

/** Test/helper access to the shared in-memory bus. */
export function getSharedGroceryRealtimeTransport() {
  return sharedTransport;
}
