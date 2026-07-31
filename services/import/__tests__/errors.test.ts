import { describe, expect, it, vi } from 'vitest';

vi.mock('../authenticatedRequest', () => ({
  AuthenticatedRequestError: class extends Error {
    code = 'auth_required';
  },
}));

import { mapImportResponseError } from '../errors';

describe('import response error mapping', () => {
  it.each([
    [401, 'auth_required'],
    [429, 'quota_exceeded'],
    [422, 'needs_input'],
  ] as const)('maps HTTP %s to %s', (status, code) => {
    expect(mapImportResponseError(status, null, 'recipe')).toMatchObject({ code });
  });

  it('preserves a safe backend message for actionable input errors', () => {
    expect(
      mapImportResponseError(422, { message: 'Paste the recipe caption to continue.' }, 'recipe'),
    ).toMatchObject({
      code: 'needs_input',
      message: 'Paste the recipe caption to continue.',
    });
  });

  it('maps unexpected service failures to a retryable network error', () => {
    expect(mapImportResponseError(503, null, 'photo')).toMatchObject({
      code: 'network',
      message: expect.stringContaining('temporarily unavailable'),
    });
  });
});
