import * as SecureStore from 'expo-secure-store';

import type { AuthTokens, SecureTokenStorage } from '@/data/sync/contracts';

/** Key used only with expo-secure-store — never write this to AsyncStorage. */
export const SECURE_TOKEN_STORAGE_KEY = 'whisk.auth.tokens.v1';

function parseTokens(raw: string | null): AuthTokens | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthTokens>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      (parsed.expiresAtIso !== null &&
        parsed.expiresAtIso !== undefined &&
        typeof parsed.expiresAtIso !== 'string')
    ) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAtIso: parsed.expiresAtIso ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Hardware-backed / OS secure storage for auth tokens (SECURITY.md).
 * Guest entitlement flags stay in AsyncStorage via trust/sessionStore.
 */
export function createSecureTokenStorage(
  options: { key?: string } = {},
): SecureTokenStorage {
  const key = options.key ?? SECURE_TOKEN_STORAGE_KEY;
  return {
    async read() {
      const raw = await SecureStore.getItemAsync(key);
      return parseTokens(raw);
    },
    async write(tokens) {
      await SecureStore.setItemAsync(key, JSON.stringify(tokens));
    },
    async clear() {
      await SecureStore.deleteItemAsync(key);
    },
  };
}

/** In-memory secure storage for Jest — mirrors the SecureTokenStorage contract. */
export function createMemorySecureTokenStorage(): SecureTokenStorage {
  let held: AuthTokens | null = null;
  return {
    async read() {
      return held;
    },
    async write(tokens) {
      held = { ...tokens };
    },
    async clear() {
      held = null;
    },
  };
}
