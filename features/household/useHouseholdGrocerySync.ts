import { useEffect, useRef } from 'react';

import {
  createGroceryRealtimeHub,
  createHouseholdCollaboration,
  getRepositories,
  type GroceryRealtimeEvent,
  type GroceryRealtimeTransport,
  type GroceryRealtimeUnsubscribe,
} from '@/data';
import { getAuthTokens, useAuthSessionStore } from '@/data/sync/authSession';
import {
  createAppGroceryRealtimeTransport,
  householdCollaborationCloudOptions,
} from '@/data/sync/appCloudWiring';
import { isHttpSyncConfigured } from '@/data/sync/httpTransports';
import {
  createCloudGroceryRealtimeTransport,
  getProcessSharedCloudBackend,
} from '@/data/sync/cloudBackend';

const processSharedTransport = createCloudGroceryRealtimeTransport(
  getProcessSharedCloudBackend(),
);

function appGroceryTransport(): GroceryRealtimeTransport {
  if (isHttpSyncConfigured()) {
    return createAppGroceryRealtimeTransport(getAuthTokens);
  }
  return processSharedTransport;
}

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
  const transportRef = useRef(appGroceryTransport());

  useEffect(() => {
    if (mode !== 'signed_in' || !userId || !householdId || !listId) {
      return;
    }

    let cancelled = false;
    let unsubscribe: GroceryRealtimeUnsubscribe | null = null;

    void (async () => {
      try {
        const repos = getRepositories();
        const collab = createHouseholdCollaboration(
          repos,
          householdCollaborationCloudOptions(getAuthTokens),
        );
        if (!collab.isActiveMember(householdId, userId)) {
          return;
        }
        const tokens = await getAuthTokens();
        if (!tokens || cancelled) {
          return;
        }
        const hub = createGroceryRealtimeHub({
          transport: transportRef.current,
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

/** Test/helper access to the shared grocery bus. */
export function getSharedGroceryRealtimeTransport() {
  return appGroceryTransport();
}
