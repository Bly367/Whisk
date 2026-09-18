/**
 * P2-W1 published sync & auth contracts.
 * Later workstreams (P2-W2…W7) should depend on these shapes — not on stub internals.
 */

/** Local-first identity: guest has no user; signed-in always has an id. */
export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

/** Session / refresh tokens — store only via SecureTokenStorage. */
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAtIso: string | null;
};

export type AuthIdentity = {
  user: AuthUser;
  /** True when secure storage holds tokens; never log token values. */
  hasTokens: boolean;
};

export type AuthMode = 'guest' | 'signed_in';

export type SignInCredentials = {
  email: string;
  password: string;
};

export type SecureTokenStorage = {
  read(): Promise<AuthTokens | null>;
  write(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
};

/** Replaceable auth backend (stub today; Supabase/Apple/Google later). */
export type AuthTransport = {
  signIn(credentials: SignInCredentials): Promise<{ user: AuthUser; tokens: AuthTokens }>;
  signOut(): Promise<void>;
};

export type SyncEntityKind =
  | 'recipe'
  | 'meal_plan'
  | 'grocery_list'
  | 'household'
  | 'pantry_item'
  | 'meal_plan_template'
  | 'leftovers_link';

export type SyncPushItem = {
  kind: SyncEntityKind;
  localId: string;
  revision: number;
  body: Record<string, unknown>;
};

export type SyncPushRequest = {
  householdId: string | null;
  items: SyncPushItem[];
};

export type SyncPushResult = {
  accepted: string[];
  rejected: { localId: string; reason: string }[];
};

export type SyncPullRequest = {
  householdId: string | null;
  sinceIso: string | null;
};

export type SyncPullItem = {
  kind: SyncEntityKind;
  remoteId: string;
  localId: string | null;
  revision: number;
  body: Record<string, unknown>;
  updatedAtIso: string;
};

export type SyncPullResult = {
  items: SyncPullItem[];
  serverTimeIso: string;
};

/** Replaceable sync transport (stub OK until realtime backend ships). */
export type SyncTransport = {
  push(request: SyncPushRequest, tokens: AuthTokens): Promise<SyncPushResult>;
  pull(request: SyncPullRequest, tokens: AuthTokens): Promise<SyncPullResult>;
  /** Test/observability surface for stub implementations. */
  calls?: {
    push: { request: SyncPushRequest; tokens: AuthTokens }[];
    pull: { request: SyncPullRequest; tokens: AuthTokens }[];
  };
};

export type SyncClientPushOutcome = SyncPushResult | { skipped: 'guest' };
export type SyncClientPullOutcome = SyncPullResult | { skipped: 'guest' };

export type SyncClient = {
  pushPending(request: SyncPushRequest): Promise<SyncClientPushOutcome>;
  pull(request: SyncPullRequest): Promise<SyncClientPullOutcome>;
  /**
   * Local write first; only then attempt remote push.
   * Never reports cloud "synced" if local persistence failed.
   */
  persistLocalThenSync<T>(args: {
    localWrite: () => T;
    pushRequest: SyncPushRequest;
  }): Promise<{ local: T; remote: SyncClientPushOutcome }>;
};
