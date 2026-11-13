import { create } from 'zustand';

import { addDays, startOfWeekMonday } from '@/lib/dates';
import type { MealSlot } from '@/data/contracts';

/**
 * Plan tab UI/session only — week selection survives tab switches.
 * Meal plan rows live in SQLite via `mealPlans`.
 */
export type PlanUiState = {
  weekStart: string;
  setWeekStart: (weekStart: string) => void;
  goToCurrentWeek: () => void;
  shiftWeek: (deltaWeeks: number) => void;
};

export const usePlanUiStore = create<PlanUiState>((set, get) => ({
  weekStart: startOfWeekMonday(),
  setWeekStart: (weekStart) => set({ weekStart }),
  goToCurrentWeek: () => set({ weekStart: startOfWeekMonday() }),
  shiftWeek: (deltaWeeks) => {
    set({ weekStart: addDays(get().weekStart, deltaWeeks * 7) });
  },
}));

export type PickerTarget = {
  planDate: string;
  slot: MealSlot;
};

export type EntryActionTarget = {
  entryId: string;
  recipeTitle: string;
  planDate: string;
  slot: MealSlot;
};
