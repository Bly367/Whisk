import { supabase } from '../../lib/supabase';

type SessionResult = {
  data: { session: { access_token: string } | null };
  error?: { message: string } | null;
};

export interface AuthenticatedHeaderDependencies {
  getSession: () => Promise<SessionResult>;
  publishableKey?: string;
}

export class AuthenticatedRequestError extends Error {
  constructor(
    message: string,
    public readonly code: 'auth_required' | 'configuration',
  ) {
    super(message);
    this.name = 'AuthenticatedRequestError';
  }
}

const defaultDependencies: AuthenticatedHeaderDependencies = {
  getSession: async () => {
    if (!supabase) {
      throw new AuthenticatedRequestError(
        'Protected imports are not configured on this device.',
        'configuration',
      );
    }
    return supabase.auth.getSession();
  },
  publishableKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

export async function createAuthenticatedImportHeaders(
  dependencies: AuthenticatedHeaderDependencies = defaultDependencies,
): Promise<Record<string, string>> {
  if (!dependencies.publishableKey) {
    throw new AuthenticatedRequestError(
      'Protected imports are not configured on this device.',
      'configuration',
    );
  }

  let result: SessionResult;
  try {
    result = await dependencies.getSession();
  } catch (error) {
    if (error instanceof AuthenticatedRequestError) throw error;
    throw new AuthenticatedRequestError(
      'Whisk could not verify your sign-in. Please sign in again.',
      'auth_required',
    );
  }

  const accessToken = result.data.session?.access_token;
  if (result.error || !accessToken) {
    throw new AuthenticatedRequestError(
      'Sign in to import recipes with Whisk.',
      'auth_required',
    );
  }

  return {
    apikey: dependencies.publishableKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}
