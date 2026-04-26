import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useSubmitRequest } from './useSubmitRequest';
import { hcmClient } from '@/lib/hcm-client';
import { useInFlightMutationsStore, useNotificationsStore } from '@/store';
import { queryKeys } from '@/lib/query-keys';
import type { Balance } from '@/features/time-off/shared/types';

vi.mock('@/lib/hcm-client', () => ({
  hcmClient: { submitRequest: vi.fn(), getBalance: vi.fn() },
  HCMTimeoutError: class HCMTimeoutError extends Error {
    constructor(endpoint: string) { super(endpoint); this.name = 'HCMTimeoutError'; }
  },
  HCMError: class HCMError extends Error {
    status: number; code: string; data: Record<string, unknown>;
    constructor(status: number, code: string, data = {}) {
      super(code); this.name = 'HCMError'; this.status = status; this.code = code; this.data = data;
    }
  },
}));

const EMPLOYEE_ID = 'emp-1';
const LOCATION_ID = 'loc-annual';
const CELL_KEY = `${EMPLOYEE_ID}:${LOCATION_ID}`;

const seedBalance: Balance = {
  employeeId: EMPLOYEE_ID, locationId: LOCATION_ID,
  locationName: 'Annual Leave', available: 15, pending: 0, fetchedAt: Date.now(),
};

const submitVariables = {
  employeeId: EMPLOYEE_ID, locationId: LOCATION_ID,
  days: 3, startDate: '2026-05-01', endDate: '2026-05-03',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.balance(EMPLOYEE_ID, LOCATION_ID), seedBalance);
  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
    queryClient,
  };
}

describe('useSubmitRequest', () => {
  beforeEach(() => {
    useInFlightMutationsStore.setState({ mutations: new Set() });
    useNotificationsStore.setState({ queue: [] });
  });

  afterEach(() => vi.clearAllMocks());

  // ── Phase 1: Optimistic apply ──────────────────────────────────────────

  it('Phase 1: applies optimistic update before HCM responds', async () => {
    vi.mocked(hcmClient.submitRequest).mockImplementation(() => new Promise(() => {}));
    const { wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useSubmitRequest(), { wrapper });

    act(() => { result.current.mutate(submitVariables); });

    await waitFor(() => {
      const balance = queryClient.getQueryData<Balance>(
        queryKeys.balance(EMPLOYEE_ID, LOCATION_ID),
      );
      expect(balance?.available).toBe(12); // 15 - 3
      expect(balance?.pending).toBe(3);
    });
  });

  it('Phase 1: registers in-flight mutation key', async () => {
    vi.mocked(hcmClient.submitRequest).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSubmitRequest(), { wrapper });

    act(() => { result.current.mutate(submitVariables); });

    await waitFor(() => {
      expect(useInFlightMutationsStore.getState().has(CELL_KEY)).toBe(true);
    });
  });

  // ── Phase 3a: Success + canonical re-read confirms ─────────────────────

  it('Phase 3a: clears in-flight after successful mutation', async () => {
    vi.mocked(hcmClient.submitRequest).mockResolvedValue({ requestId: 'req-1', status: 'accepted' });
    vi.mocked(hcmClient.getBalance).mockResolvedValue({ ...seedBalance, available: 12, fetchedAt: Date.now() });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSubmitRequest(), { wrapper });

    await act(async () => { result.current.mutate(submitVariables); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(useInFlightMutationsStore.getState().has(CELL_KEY)).toBe(false);
    });
  });

  // ── Phase 3a: Silent success detection ────────────────────────────────

  it('Phase 3a: rolls back and notifies when balance did not decrease (silent success)', async () => {
    vi.mocked(hcmClient.submitRequest).mockResolvedValue({ requestId: 'req-1', status: 'accepted' });
    // Canonical re-read returns SAME balance — HCM lied
    vi.mocked(hcmClient.getBalance).mockResolvedValue({ ...seedBalance, available: 15 });

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useSubmitRequest(), { wrapper });

    await act(async () => { result.current.mutate(submitVariables); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Balance should be rolled back to snapshot
    await waitFor(() => {
      const balance = queryClient.getQueryData<Balance>(
        queryKeys.balance(EMPLOYEE_ID, LOCATION_ID),
      );
      expect(balance?.available).toBe(15);
    });

    // Rollback notification pushed
    const { queue } = useNotificationsStore.getState();
    expect(queue.some((n) => n.type === 'rollback' && /did not record/i.test(n.message))).toBe(true);
  });

  // ── Phase 3b: Error / rollback ─────────────────────────────────────────

  it('Phase 3b: restores snapshot when HCM returns an error', async () => {
    vi.mocked(hcmClient.submitRequest).mockRejectedValue(new Error('Network error'));

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useSubmitRequest(), { wrapper });

    await act(async () => { result.current.mutate(submitVariables); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const balance = queryClient.getQueryData<Balance>(queryKeys.balance(EMPLOYEE_ID, LOCATION_ID));
    expect(balance?.available).toBe(15); // restored to original
    expect(balance?.pending).toBe(0);
  });

  it('Phase 3b: pushes rollback notification on HCM timeout', async () => {
    const { HCMTimeoutError: TimeoutErr } = await import('@/lib/hcm-client');
    vi.mocked(hcmClient.submitRequest).mockRejectedValue(new TimeoutErr('/api/mock/hcm/requests'));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSubmitRequest(), { wrapper });

    await act(async () => { result.current.mutate(submitVariables); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { queue } = useNotificationsStore.getState();
    expect(queue.some((n) => n.type === 'rollback' && /timed out/i.test(n.message))).toBe(true);
  });

  // ── Phase 4: Settled ───────────────────────────────────────────────────

  it('Phase 4: removes in-flight key after error', async () => {
    vi.mocked(hcmClient.submitRequest).mockRejectedValue(new Error('fail'));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSubmitRequest(), { wrapper });

    await act(async () => { result.current.mutate(submitVariables); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(useInFlightMutationsStore.getState().has(CELL_KEY)).toBe(false);
  });
});
