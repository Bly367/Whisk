/**
 * App wiring for sync/auth/household cloud — in-process shared backend by default,
 * HTTP sync server when EXPO_PUBLIC_WHISK_SYNC_URL is set.
 */

import {
  createCloudAuthTransport,
  createCloudEntitlementClient,
  createCloudGroceryRealtimeTransport,
  createDefaultCloudStack,
  getProcessSharedCloudBackend,
  type CloudHouseholdSnapshot,
  type EntitlementClient,
  type SharedCloudBackend,
} from '@/data/sync/cloudBackend';
import type { AuthTransport, SecureTokenStorage } from '@/data/sync/contracts';
import type { GroceryRealtimeTransport } from '@/data/sync/groceryRealtime';
import {
  createHttpAuthTransport,
  createHttpEntitlementClient,
  createHttpGroceryRealtimeTransport,
  isHttpSyncConfigured,
  joinHouseholdViaHttp,
  resolveInviteViaHttp,
} from '@/data/sync/httpTransports';
import type { HouseholdCollaborationOptions } from '@/features/household/collaboration';

export function createAppAuthTransport(storage: SecureTokenStorage): AuthTransport {
  if (isHttpSyncConfigured()) {
    return createHttpAuthTransport();
  }
  const cloud = getProcessSharedCloudBackend();
  return createCloudAuthTransport(cloud, {
    getAccessToken: async () => (await storage.read())?.accessToken ?? null,
  });
}

export function createAppEntitlementClient(
  getTokens: () => Promise<import('@/data/sync/contracts').AuthTokens | null>,
): EntitlementClient {
  if (isHttpSyncConfigured()) {
    return createHttpEntitlementClient(getTokens);
  }
  return createCloudEntitlementClient(getProcessSharedCloudBackend());
}

export function createAppGroceryRealtimeTransport(
  getTokens: () => Promise<import('@/data/sync/contracts').AuthTokens | null>,
): GroceryRealtimeTransport {
  if (isHttpSyncConfigured()) {
    return createHttpGroceryRealtimeTransport(getTokens);
  }
  return createCloudGroceryRealtimeTransport(getProcessSharedCloudBackend());
}

export function getAppCloudBackend(): SharedCloudBackend | null {
  if (isHttpSyncConfigured()) {
    return null;
  }
  return getProcessSharedCloudBackend();
}

export function householdCollaborationCloudOptions(
  getTokens: () => Promise<import('@/data/sync/contracts').AuthTokens | null>,
): HouseholdCollaborationOptions {
  if (isHttpSyncConfigured()) {
    return {
      resolveInviteRemote: (inviteCode) => resolveInviteViaHttp(inviteCode),
      registerHouseholdRemote: async (snapshot) => {
        const tokens = await getTokens();
        if (!tokens) return;
        const base = process.env.EXPO_PUBLIC_WHISK_SYNC_URL?.replace(/\/$/, '');
        if (!base) return;
        await fetch(`${base}/households/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          body: JSON.stringify(snapshot),
        });
      },
      addMemberRemote: async ({ inviteCode, displayName }) => {
        try {
          return await joinHouseholdViaHttp(inviteCode, displayName, getTokens);
        } catch {
          return null;
        }
      },
    };
  }
  return { cloud: getProcessSharedCloudBackend() };
}

export function describeSyncBackend(): 'http' | 'process-shared' {
  return isHttpSyncConfigured() ? 'http' : 'process-shared';
}

export { createDefaultCloudStack, isHttpSyncConfigured };

export type { CloudHouseholdSnapshot };
