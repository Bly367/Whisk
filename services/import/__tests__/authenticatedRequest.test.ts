import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({ supabase: null }));

import {
  AuthenticatedRequestError,
  createAuthenticatedImportHeaders,
} from '../authenticatedRequest';

describe('authenticated import headers', () => {
  it('includes both the API key and current user access token', async () => {
    const headers = await createAuthenticatedImportHeaders({
      publishableKey: 'publishable-key',
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'user-token' } },
      }),
    });

    expect(headers).toEqual({
      apikey: 'publishable-key',
      Authorization: 'Bearer user-token',
      'Content-Type': 'application/json',
    });
  });

  it('fails clearly when no user is signed in', async () => {
    await expect(
      createAuthenticatedImportHeaders({
        publishableKey: 'publishable-key',
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      }),
    ).rejects.toMatchObject({
      code: 'auth_required',
      message: expect.stringContaining('Sign in'),
    } satisfies Partial<AuthenticatedRequestError>);
  });

  it('does not create a protected request without an API key', async () => {
    await expect(
      createAuthenticatedImportHeaders({
        getSession: vi.fn(),
      }),
    ).rejects.toMatchObject({
      code: 'configuration',
    } satisfies Partial<AuthenticatedRequestError>);
  });
});
