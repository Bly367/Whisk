import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { currentWeekStartIso, type FreeTierUsage } from '@/features/trust/freeTier';

const STORAGE_KEY = 'whisk.session.v1';

export type SessionMode = 'guest' | 'signed_in';

export type SessionState = {
  mode: SessionMode;
  hydrated: boolean;
  usage: FreeTierUsage;
  hydrate: () => Promise<void>;
  setMode: (mode: SessionMode) => Promise<void>;
  recordImportStarted: () => Promise<void>;
  setDowngraded: (value: boolean) => Promise<void>;
  resetUsageForTests: (usage?: Partial<FreeTierUsage>) => void;
};

type PersistedSession = {
  mode: SessionMode;
  usage: FreeTierUsage;
};

async function writePersisted(state: PersistedSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

export const useSessionStore = create<SessionState>((set, get) => ({
  mode: 'guest',
  hydrated: false,
  usage: defaultUsage(),

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSession;
        set({
          mode: parsed.mode ?? 'guest',
          usage: normalizeUsage(parsed.usage ?? defaultUsage()),
          hydrated: true,
        });
        return;
      }
    } catch {
      // Fall through to defaults — guest mode always works offline.
    }
    set({ hydrated: true, mode: 'guest', usage: defaultUsage() });
  },

  async setMode(mode) {
    set({ mode });
    const { usage } = get();
    await writePersisted({ mode, usage });
  },

  async recordImportStarted() {
    const usage = normalizeUsage(get().usage);
    const next: FreeTierUsage = {
      ...usage,
      importsUsedThisWeek: usage.importsUsedThisWeek + 1,
    };
    set({ usage: next });
    await writePersisted({ mode: get().mode, usage: next });
  },

  async setDowngraded(value) {
    const usage = { ...normalizeUsage(get().usage), isDowngraded: value };
    set({ usage });
    await writePersisted({ mode: get().mode, usage });
  },

  resetUsageForTests(partial = {}) {
    const usage = { ...defaultUsage(), ...partial };
    set({ usage, hydrated: true, mode: 'guest' });
  },
}));
