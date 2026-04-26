import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hcmStore } from '@/lib/mock-hcm/store';
import { seedStore } from '@/lib/mock-hcm/fixtures';
import { submitRequest } from '@/lib/mock-hcm/logic';

describe('overlapping time-off requests (integration)', () => {
  beforeEach(() => {
    seedStore(hcmStore);
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // avoid silent-success flake
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a second request that overlaps dates for the same employee + location', () => {
    const first = submitRequest(hcmStore, {
      employeeId: 'e-100',
      locationId: 'loc-sick',
      days: 2,
      startDate: '2026-04-28',
      endDate: '2026-04-29',
    });
    expect(first.status).toBe(200);

    const second = submitRequest(hcmStore, {
      employeeId: 'e-100',
      locationId: 'loc-sick',
      days: 1,
      startDate: '2026-04-29',
      endDate: '2026-04-29',
    });
    expect(second.status).toBe(409);
    expect((second.body as { error?: string }).error).toBe('OVERLAPPING_REQUEST');
  });

  it('allows non-overlapping adjacent ranges for the same employee + location', () => {
    const first = submitRequest(hcmStore, {
      employeeId: 'e-100',
      locationId: 'loc-sick',
      days: 2,
      startDate: '2026-04-28',
      endDate: '2026-04-29',
    });
    expect(first.status).toBe(200);

    const second = submitRequest(hcmStore, {
      employeeId: 'e-100',
      locationId: 'loc-sick',
      days: 1,
      startDate: '2026-04-30',
      endDate: '2026-04-30',
    });
    expect(second.status).toBe(200);
  });

  it('rejects overlapping dates across different leave types (different locations)', () => {
    const sick = submitRequest(hcmStore, {
      employeeId: 'e-100',
      locationId: 'loc-sick',
      days: 1,
      startDate: '2026-04-28',
      endDate: '2026-04-28',
    });
    expect(sick.status).toBe(200);

    const personal = submitRequest(hcmStore, {
      employeeId: 'e-100',
      locationId: 'loc-personal',
      days: 1,
      startDate: '2026-04-28',
      endDate: '2026-04-28',
    });
    expect(personal.status).toBe(409);
    expect((personal.body as { error?: string }).error).toBe('OVERLAPPING_REQUEST');
  });
});
