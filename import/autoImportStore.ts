import { create } from 'zustand';

export type LastAutoImport = {
  recipeId: string;
  source: string;
  lowConfidence: boolean;
  hints?: string[];
};
type AutoImportState = {
  last: LastAutoImport | null;
  setLast: (value: LastAutoImport) => void;
  clear: () => void;
};
export const useAutoImportStore = create<AutoImportState>((set) => ({
  last: null,
  setLast: (last) => set({ last }),
  clear: () => set({ last: null }),
}));
