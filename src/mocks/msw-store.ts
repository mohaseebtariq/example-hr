import { createStore } from '@/lib/mock-hcm/store';
import { seedStore } from '@/lib/mock-hcm/fixtures';
import type { HcmStore } from '@/lib/mock-hcm/store';

let store: HcmStore | null = null;

export function getMswStore(): HcmStore {
  if (!store) {
    store = createStore();
    seedStore(store);
  }
  return store;
}

export function resetMswStore(): void {
  store = createStore();
  seedStore(store);
}

