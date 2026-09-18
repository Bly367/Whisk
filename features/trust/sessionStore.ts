import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { EntitlementClient } from '@/data/sync/cloudBackend';
import {
  createCloudEntitlementClient,
  getProcessSharedCloudBackend,
} from '@/data/sync/cloudBackend';
import {
  currentWeekStartIso,
  defaultUnlockPricing,
  type Entitlement,
  type FreeTierUsage,
  type UnlockPricing,
} from '@/features/trust/freeTier';
import {
  normalizeInfluencerCode,
  redeemInfluencerCode,
  type RedeemCodeResult,
} from '@/features/trust/influencerCodes';

const STORAGE_KEY = 'whisk.session.v1';

export type SessionMode = 'guest' | 'signed_in';

export type SessionState = {
  mode: SessionMode;
  hydrated: boolean;
  usage: FreeTierUsage;
  entitlement: Entitlement;
  unlockPricing: UnlockPricing;
  hydrate: () => Promise<void>;
  setMode: (mode: SessionMode) => Promise<void>;
  recordImportStarted: () => Promise<void>;
  setDowngraded: (value: boolean) => Promise<void>;
  /**
   * One-time unlock at the current (possibly discounted) price.
   * When signed in with a userId, writes entitlement to the cloud account so
   * other devices restore it after sign-in.
   */
  unlockWithPurchase: (accountUserId?: string | null) => Promise<void>;
  /** Clear paid unlock (not admin). Used for downgrade simulation. */
  clearPaidUnlock: () => Promise<void>;
  /** Pull account-bound entitlement after sign-in / hydrate. */
  restoreEntitlementFromAccount: (userId: string) => Promise<void>;
  applyInfluencerCode: (raw: string) => Promise<RedeemCodeResult>;
  clearDiscountCode: () => Promise<void>;
  configureEntitlementClientForTests: (client: EntitlementClient | null) => void;
  resetUsageForTests: (usage?: Partial<FreeTierUsage>) => void;
  resetSessionForTests: (partial?: {
    mode?: SessionMode;
    usage?: Partial<FreeTierUsage>;
    entitlement?: Entitlement;
    unlockPricing?: UnlockPricing;
  }) => void;
};

let entitlementClient: EntitlementClient | null = createCloudEntitlementClient(
  getProcessSharedCloudBackend(),
);

type PersistedSession = {
  mode: SessionMode;
  usage: FreeTierUsage;
  entitlement?: Entitlement;
  unlockPricing?: UnlockPricing;
  /** Legacy field from earlier builds; migrated on hydrate. */
  appliedDiscountCode?: string | null;
};

async function writePersisted(state: {
  mode: SessionMode;
  usage: FreeTierUsage;
  entitlement: Entitlement;
  unlockPricing: UnlockPricing;
}): Promise<void> {
  const payload: PersistedSession = {
    mode: state.mode,
    usage: state.usage,
    entitlement: state.entitlement,
    unlockPricing: state.unlockPricing,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function defaultUsage(): FreeTierUsage {
  return {
    importsUsedThisWeek: 0,
    weekStartIso: currentWeekStartIso(),
    isDowngraded: false,
  };
}

function normalizeUsage(usage: FreeTierUsage): FreeTierUsage {
  const week = currentWeekStartIso();
  if (usage.weekStartIso !== week) {
    return {
      importsUsedThisWeek: 0,
      weekStartIso: week,
      isDowngraded: usage.isDowngraded,
    };
  }
  return usage;
}

function normalizeEntitlement(value: unknown): Entitlement {
  if (value === 'unlocked' || value === 'admin' || value === 'free') {
    return value;
  }
  return 'free';
}

function normalizePricing(value: unknown): UnlockPricing {
  if (
    value &&
    typeof value === 'object' &&
    'priceCents' in value &&
    typeof (value as UnlockPricing).priceCents === 'number' &&
    typeof (value as UnlockPricing).priceLabel === 'string'
  ) {
    const pricing = value as UnlockPricing;
    return {
      priceCents: pricing.priceCents,
      priceLabel: pricing.priceLabel,
      isDiscounted: Boolean(pricing.isDiscounted),
      influencerCode: pricing.influencerCode ?? null,
      influencerId: pricing.influencerId ?? null,
    };
  }
  return defaultUnlockPricing();
}

export const useSessionStore = create<SessionState>((set, get) => ({
  mode: 'guest',
  hydrated: false,
  usage: defaultUsage(),
  entitlement: 'free',
  unlockPricing: defaultUnlockPricing(),

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSession;
        set({
          mode: parsed.mode ?? 'guest',
          usage: normalizeUsage(parsed.usage ?? defaultUsage()),
          entitlement: normalizeEntitlement(parsed.entitlement),
          unlockPricing: normalizePricing(parsed.unlockPricing),
          hydrated: true,
        });
        return;
      }
    } catch {
      // Fall through to defaults — guest mode always works offline.
    }
    set({
      hydrated: true,
      mode: 'guest',
      usage: defaultUsage(),
      entitlement: 'free',
      unlockPricing: defaultUnlockPricing(),
    });
  },

  async setMode(mode) {
    set({ mode });
    const { usage, entitlement, unlockPricing } = get();
    await writePersisted({ mode, usage, entitlement, unlockPricing });
  },

  async recordImportStarted() {
    const { entitlement } = get();
    if (entitlement === 'unlocked' || entitlement === 'admin') {
      return;
    }
    const usage = normalizeUsage(get().usage);
    const next: FreeTierUsage = {
      ...usage,
      importsUsedThisWeek: usage.importsUsedThisWeek + 1,
    };
    set({ usage: next });
    await writePersisted({
      mode: get().mode,
      usage: next,
      entitlement: get().entitlement,
      unlockPricing: get().unlockPricing,
    });
  },

  async setDowngraded(value) {
    const usage = { ...normalizeUsage(get().usage), isDowngraded: value };
    const entitlement = value && get().entitlement === 'unlocked' ? 'free' : get().entitlement;
    set({ usage, entitlement });
    await writePersisted({
      mode: get().mode,
      usage,
      entitlement,
      unlockPricing: get().unlockPricing,
    });
  },

  async unlockWithPurchase(accountUserId) {
    const usage = { ...normalizeUsage(get().usage), isDowngraded: false };
    set({ entitlement: 'unlocked', usage });
    await writePersisted({
      mode: get().mode,
      usage,
      entitlement: 'unlocked',
      unlockPricing: get().unlockPricing,
    });
    const userId = accountUserId?.trim();
    if (userId && entitlementClient && get().mode === 'signed_in') {
      await entitlementClient.setEntitlement(userId, 'unlocked');
    }
  },

  async clearPaidUnlock() {
    if (get().entitlement === 'admin') {
      return;
    }
    const usage = { ...normalizeUsage(get().usage), isDowngraded: true };
    set({ entitlement: 'free', usage });
    await writePersisted({
      mode: get().mode,
      usage,
      entitlement: 'free',
      unlockPricing: get().unlockPricing,
    });
  },

  async restoreEntitlementFromAccount(userId) {
    if (!entitlementClient || !userId.trim()) {
      return;
    }
    const remote = await entitlementClient.getEntitlement(userId);
    if (remote === 'free') {
      return;
    }
    const usage = { ...normalizeUsage(get().usage), isDowngraded: false };
    set({ entitlement: remote, usage });
    await writePersisted({
      mode: get().mode,
      usage,
      entitlement: remote,
      unlockPricing: get().unlockPricing,
    });
  },

  configureEntitlementClientForTests(client) {
    entitlementClient = client;
  },

  async applyInfluencerCode(raw) {
    const result = redeemInfluencerCode(raw, { currentEntitlement: get().entitlement });
    if (!result.ok) {
      return result;
    }

    if (result.kind === 'admin') {
      const usage = { ...normalizeUsage(get().usage), isDowngraded: false };
      set({ entitlement: 'admin', usage });
      await writePersisted({
        mode: get().mode,
        usage,
        entitlement: 'admin',
        unlockPricing: get().unlockPricing,
      });
      return result;
    }

    const unlockPricing = {
      ...result.pricing,
      influencerCode: normalizeInfluencerCode(result.definition.code),
    };
    set({ unlockPricing });
    await writePersisted({
      mode: get().mode,
      usage: get().usage,
      entitlement: get().entitlement,
      unlockPricing,
    });
    return result;
  },

  async clearDiscountCode() {
    if (get().entitlement === 'admin') {
      return;
    }
    const unlockPricing = defaultUnlockPricing();
    set({ unlockPricing });
    await writePersisted({
      mode: get().mode,
      usage: get().usage,
      entitlement: get().entitlement,
      unlockPricing,
    });
  },

  resetUsageForTests(partial = {}) {
    const usage = { ...defaultUsage(), ...partial };
    set({
      usage,
      hydrated: true,
      mode: 'guest',
      entitlement: 'free',
      unlockPricing: defaultUnlockPricing(),
    });
  },

  resetSessionForTests(partial = {}) {
    entitlementClient = createCloudEntitlementClient(getProcessSharedCloudBackend());
    set({
      hydrated: true,
      mode: partial.mode ?? 'guest',
      usage: { ...defaultUsage(), ...(partial.usage ?? {}) },
      entitlement: partial.entitlement ?? 'free',
      unlockPricing: partial.unlockPricing ?? defaultUnlockPricing(),
    });
  },
}));
