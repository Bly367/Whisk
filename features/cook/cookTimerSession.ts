/**
 * P2-W8 — in-session multi-timer state for cook mode (UI/session only; not a recipe DB).
 */
import { create } from 'zustand';

import {
  acknowledgeTimerCompletion,
  createCookTimer,
  pauseCookTimer,
  resumeCookTimer,
  tickCookTimers,
  type CookTimer,
} from '@/features/cook/cookTimers';

type CookTimerSessionState = {
  recipeId: string | null;
  timers: CookTimer[];
  /** Bind timers to a cook session; clears when recipe changes. */
  beginSession: (recipeId: string) => void;
  endSession: () => void;
  addTimer: (input: { label: string; durationMs: number; nowMs?: number }) => string;
  removeTimer: (id: string) => void;
  /** Available for future UI; cook panel currently focuses on add/dismiss for large targets. */
  pauseTimer: (id: string, nowMs?: number) => void;
  resumeTimer: (id: string, nowMs?: number) => void;
  tick: (nowMs?: number) => void;
  acknowledgeCompletion: (id: string) => void;
  clearCompleted: () => void;
  /** Test helper */
  replaceTimersForTests: (timers: CookTimer[], recipeId?: string | null) => void;
};

let nextId = 0;

function newTimerId(): string {
  nextId += 1;
  return `cook-timer-${nextId}`;
}

export const useCookTimerSession = create<CookTimerSessionState>((set, get) => ({
  recipeId: null,
  timers: [],

  beginSession(recipeId) {
    const current = get().recipeId;
    if (current === recipeId) return;
    set({ recipeId, timers: [] });
  },

  endSession() {
    set({ recipeId: null, timers: [] });
  },

  addTimer({ label, durationMs, nowMs = Date.now() }) {
    const id = newTimerId();
    const timer = createCookTimer({ id, label, durationMs, createdAt: nowMs });
    set({ timers: [...get().timers, timer] });
    return id;
  },

  removeTimer(id) {
    set({ timers: get().timers.filter((t) => t.id !== id) });
  },

  pauseTimer(id, nowMs = Date.now()) {
    set({
      timers: get().timers.map((t) => (t.id === id ? pauseCookTimer(t, nowMs) : t)),
    });
  },

  resumeTimer(id, nowMs = Date.now()) {
    set({
      timers: get().timers.map((t) => (t.id === id ? resumeCookTimer(t, nowMs) : t)),
    });
  },

  tick(nowMs = Date.now()) {
    set({ timers: tickCookTimers(get().timers, nowMs) });
  },

  acknowledgeCompletion(id) {
    set({
      timers: get().timers.map((t) => (t.id === id ? acknowledgeTimerCompletion(t) : t)),
    });
  },

  clearCompleted() {
    set({ timers: get().timers.filter((t) => t.status !== 'completed') });
  },

  replaceTimersForTests(timers, recipeId = 'test-recipe') {
    set({ timers, recipeId });
  },
}));
