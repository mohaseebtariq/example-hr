import type { Balance } from '@/features/time-off/shared/types/balance';
import type { TimeOffRequest } from '@/features/time-off/shared/types/request';

export type Employee = {
  id: string;
  name: string;
  managerId: string;
};

export type HcmStore = {
  employees: Map<string, Employee>;
  balances: Map<string, Balance>;
  requests: Map<string, TimeOffRequest>;
};

export function createStore(): HcmStore {
  return {
    employees: new Map(),
    balances: new Map(),
    requests: new Map(),
  };
}

// Composite key used throughout — matches the inFlightMutations key format
export function balanceKey(employeeId: string, locationId: string): string {
  return `${employeeId}:${locationId}`;
}

// Dev/HMR-safe singleton:
// Next.js dev can reload route handler modules, which would otherwise reset a
// module-level store and create phantom requests / mismatched canonical reads.
type GlobalMockHcm = {
  store: HcmStore;
  isSeeded: boolean;
};

const globalKey = '__examplehrMockHcm__';
const globalState = (globalThis as unknown as Record<string, unknown>)[
  globalKey
] as GlobalMockHcm | undefined;

const state: GlobalMockHcm =
  globalState ?? { store: createStore(), isSeeded: false };

// Persist across module reloads in dev
(globalThis as unknown as Record<string, unknown>)[globalKey] = state;

export const hcmStore = state.store;

export async function ensureSeeded() {
  if (state.isSeeded) return;
  const { seedStore } = await import('./fixtures');
  seedStore(hcmStore);
  state.isSeeded = true;
}
