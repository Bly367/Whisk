import { create } from 'zustand';

import type { ParsedShareIntent } from '@/import/shareIntent';

type SharePayloadState = {
  payload: ParsedShareIntent | null;
  setPayload: (payload: ParsedShareIntent | null) => void;
  takePayload: () => ParsedShareIntent | null;
};

export const useSharePayloadStore = create<SharePayloadState>((set, get) => ({
  payload: null,
  setPayload: (payload) => set({ payload }),
  takePayload: () => {
    const payload = get().payload;
    if (payload) set({ payload: null });
    return payload;
  },
}));
