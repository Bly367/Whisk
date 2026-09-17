import type {
  AuthTokens,
  SyncClient,
  SyncClientPullOutcome,
  SyncClientPushOutcome,
  SyncPullRequest,
  SyncPushRequest,
  SyncTransport,
} from '@/data/sync/contracts';
import {
  reportLocalPersistFailure,
  useSyncStatusStore,
  withLocalPersist,
} from '@/data/sync/statusStore';

type SyncClientDeps = {
  transport: SyncTransport;
  getTokens: () => Promise<AuthTokens | null>;
};

/**
 * Stub transport for Phase 2 foundation — accepts all pushes, returns empty pulls.
 * Realtime household sync (P2-W3) replaces this behind the same SyncTransport contract.
 */
export function createStubSyncTransport(): SyncTransport & {
  calls: {
    push: { request: SyncPushRequest; tokens: AuthTokens }[];
    pull: { request: SyncPullRequest; tokens: AuthTokens }[];
  };
} {
  const calls = {
    push: [] as { request: SyncPushRequest; tokens: AuthTokens }[],
    pull: [] as { request: SyncPullRequest; tokens: AuthTokens }[],
  };

  return {
    calls,
    async push(request, tokens) {
      calls.push.push({ request, tokens });
      return {
        accepted: request.items.map((item) => item.localId),
        rejected: [],
      };
    },
    async pull(request, tokens) {
      calls.pull.push({ request, tokens });
      return {
        items: [],
        serverTimeIso: new Date().toISOString(),
      };
    },
  };
}

export function createSyncClient(deps: SyncClientDeps): SyncClient {
  async function pushPending(request: SyncPushRequest): Promise<SyncClientPushOutcome> {
    const tokens = await deps.getTokens();
    if (!tokens) {
      return { skipped: 'guest' };
    }
    return deps.transport.push(request, tokens);
  }

  async function pull(request: SyncPullRequest): Promise<SyncClientPullOutcome> {
    const tokens = await deps.getTokens();
    if (!tokens) {
      return { skipped: 'guest' };
    }
    return deps.transport.pull(request, tokens);
  }

  return {
    pushPending,
    pull,

    async persistLocalThenSync({ localWrite, pushRequest }) {
      let local: ReturnType<typeof localWrite>;
      try {
        local = withLocalPersist(localWrite);
      } catch (error) {
        // withLocalPersist already reported needs_attention
        throw error;
      }

      const tokens = await deps.getTokens();
      if (!tokens) {
        return { local, remote: { skipped: 'guest' } };
      }

      useSyncStatusStore.getState().markRemoteSyncStarted();
      try {
        const remote = await deps.transport.push(pushRequest, tokens);
        if (remote.rejected.length > 0 && remote.accepted.length === 0) {
          useSyncStatusStore.getState().markRemoteSyncFailed('Remote sync rejected all items.');
        } else {
          useSyncStatusStore.getState().markRemoteSyncSucceeded();
        }
        return { local, remote };
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : 'Remote sync failed.';
        // Local write already succeeded — keep lastLocalPersistAt; surface remote failure.
        useSyncStatusStore.getState().markRemoteSyncFailed(detail);
        return {
          local,
          remote: {
            accepted: [],
            rejected: pushRequest.items.map((i) => ({ localId: i.localId, reason: detail })),
          },
        };
      }
    },
  };
}

/** Convenience: report a failed local write without a remote attempt. */
export function reportSyncBlockedByLocalFailure(detail?: string): void {
  reportLocalPersistFailure(detail ?? 'Could not save on this device.');
}
