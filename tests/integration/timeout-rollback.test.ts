// @vitest-environment jsdom
// Mandatory scenario 2 (CLAUDE.md §13): Submit request → HCM timeout → rollback triggered after 8s

import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';

import { hcmStore } from '@/lib/mock-hcm/store';
import { seedStore } from '@/lib/mock-hcm/fixtures';
import { queryKeys } from '@/lib/query-keys';
import type { Balance } from '@/features/time-off/shared/types';
import { useSubmitRequest } from '@/features/time-off/employee/hooks/useSubmitRequest';
import { useNotificationsStore } from '@/store';
import { installMockHcmFetch } from './test-harness';

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('HCM timeout rollback (integration)', () => {
  beforeEach(() => {
    seedStore(hcmStore);
    useNotificationsStore.setState({ queue: [] });
    installMockHcmFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    'submit request → HCM POST never responds (AbortError) → balance rolled back + rollback notification',
    async () => {
      // Override the POST to /requests so it immediately raises an AbortError, which
      // is exactly what the hcm-client throws after the 8s AbortController fires.
      const baseImpl = vi.mocked(fetch).getMockImplementation();
      if (!baseImpl) throw new Error('Expected fetch to be mocked by test harness');

      vi.mocked(fetch).mockImplementation((input, init) => {
        const rawUrl = typeof input === 'string' ? input : String(input);
        if (rawUrl.includes('/api/mock/hcm/requests') && (init?.method ?? 'GET') === 'POST') {
          // Simulate the AbortController firing — same code path as a real 8s timeout
          return Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        }
        return baseImpl(input, init);
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const employeeId = 'e-100';
      const locationId = 'loc-annual';

      // Prime the cache so onMutate has a snapshot to restore
      const storeBalance = hcmStore.balances.get(`${employeeId}:${locationId}`);
      if (!storeBalance) throw new Error('Fixture balance not found');
      const seedBalance: Balance = { ...storeBalance, fetchedAt: Date.now() };
      queryClient.setQueryData<Balance>(queryKeys.balance(employeeId, locationId), seedBalance);

      const { result } = renderHook(() => useSubmitRequest(), {
        wrapper: makeWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({
          employeeId,
          locationId,
          days: 2,
          startDate: '2026-05-01',
          endDate: '2026-05-02',
        });
      });

      // Mutation must settle with an error (AbortError → HCMTimeoutError)
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Balance must be rolled back to the original snapshot value — not deducted
      const after = queryClient.getQueryData<Balance>(queryKeys.balance(employeeId, locationId));
      expect(after?.available).toBe(seedBalance.available);

      // A rollback notification mentioning timeout must be in the queue
      const notifications = useNotificationsStore.getState().queue;
      expect(
        notifications.some((n) => n.type === 'rollback' && /timed out/i.test(n.message)),
      ).toBe(true);
    },
  );
});
