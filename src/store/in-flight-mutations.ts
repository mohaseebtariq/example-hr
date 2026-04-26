import { create } from 'zustand';

type InFlightMutationsState = {
  mutations: Set<string>;
  add: (key: string) => void;
  remove: (key: string) => void;
  has: (key: string) => boolean;
};

export const useInFlightMutationsStore = create<InFlightMutationsState>((set, get) => ({
  mutations: new Set(),

  add: (key) =>
    set((state) => ({ mutations: new Set([...state.mutations, key]) })),

  remove: (key) =>
    set((state) => {
      const next = new Set(state.mutations);
      next.delete(key);
      return { mutations: next };
    }),

  has: (key) => get().mutations.has(key),
}));
