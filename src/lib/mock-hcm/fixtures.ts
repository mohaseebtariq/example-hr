import type { Employee, HcmStore } from './store';
import { balanceKey } from './store';

export const SEED_EMPLOYEES: Employee[] = [
  // Default demo IDs used by app routes (/employee/e-100, /manager/m-100)
  { id: 'e-100', name: 'Employee e-100', managerId: 'm-100' },
  { id: 'e-101', name: 'Employee e-101', managerId: 'm-100' },
];

type SeedBalance = {
  employeeId: string;
  locationId: string;
  locationName: string;
  available: number;
};

// fetchedAt is set to Date.now() at seed time so staleness indicators work correctly
const SEED_BALANCES: SeedBalance[] = [
  { employeeId: 'e-100', locationId: 'loc-annual',   locationName: 'Annual Leave',   available: 15 },
  { employeeId: 'e-100', locationId: 'loc-sick',     locationName: 'Sick Leave',     available: 10 },
  { employeeId: 'e-100', locationId: 'loc-personal', locationName: 'Personal Leave', available: 5  },
  { employeeId: 'e-101', locationId: 'loc-annual',   locationName: 'Annual Leave',   available: 20 },
  { employeeId: 'e-101', locationId: 'loc-sick',     locationName: 'Sick Leave',     available: 8  },
];

export function seedStore(store: HcmStore): void {
  store.employees.clear();
  store.balances.clear();
  store.requests.clear();

  for (const employee of SEED_EMPLOYEES) {
    store.employees.set(employee.id, { ...employee });
  }

  const now = Date.now();
  for (const seed of SEED_BALANCES) {
    store.balances.set(balanceKey(seed.employeeId, seed.locationId), {
      employeeId: seed.employeeId,
      locationId: seed.locationId,
      locationName: seed.locationName,
      available: seed.available,
      pending: 0,
      fetchedAt: now,
    });
  }
}
