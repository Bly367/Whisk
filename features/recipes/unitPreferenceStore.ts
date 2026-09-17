import { create } from 'zustand';

import { isUnitSystemAvailable, type UnitSystem } from '@/features/recipes/scale';

type UnitPreferenceState = {
  system: UnitSystem;
  setSystem: (system: UnitSystem) => void;
};

/**
 * UI preference hook for unit display.
 * Only `original` is active until real quantity+unit conversion ships —
 * Metric/Imperial must not remap labels alone.
 */
export const useUnitPreferenceStore = create<UnitPreferenceState>((set) => ({
  system: 'original',
  setSystem: (system) => {
    if (!isUnitSystemAvailable(system)) {
      return;
    }
    set({ system });
  },
}));
