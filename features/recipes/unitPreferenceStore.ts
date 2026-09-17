import { create } from 'zustand';

import type { UnitSystem } from '@/features/recipes/scale';

type UnitPreferenceState = {
  system: UnitSystem;
  setSystem: (system: UnitSystem) => void;
};

/** UI preference only — does not rewrite stored recipe quantities. */
export const useUnitPreferenceStore = create<UnitPreferenceState>((set) => ({
  system: 'original',
  setSystem: (system) => set({ system }),
}));
