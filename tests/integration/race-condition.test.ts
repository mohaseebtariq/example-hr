// @vitest-environment jsdom

import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { hcmStore } from '@/lib/mock-hcm/store';
import { seedStore } from '@/lib/mock-hcm/fixtures';
import { queryKeys } from '@/lib/query-keys';
import type { Balance } from '@/features/time-off/shared/types';
import { useBalance } from '@/features/time-off/employee/hooks/useBalance';
import { useSubmitRequest } from '@/features/time-off/employee/hooks/useSubmitRequest';
import { installMockHcmFetch } from './test-harness';

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('background refresh does not overwrite optimistic state (integration)', () => {
  beforeEach(() => {
    seedStore(hcmStore);
    installMockHcmFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refetch during in-flight mutation keeps optimistic balance', async () => {
    // Delay the POST so the mutation stays in-flight long enough to refetch.
    const baseImpl = vi.mocked(fetch).getMockImplementation();
    if (!baseImpl) throw new Error('Expected fetch to be mocked by test harness');

    vi.mocked(fetch).mockImplementation((input, init) => {
      const rawUrl = typeof input === 'string' ? input : String(input);
      if (rawUrl.includes('/api/mock/hcm/requests') && (init?.method ?? 'GET') === 'POST') {
        return new Promise<Response>((resolve, reject) => {
          const id = setTimeout(() => {
            baseImpl(input, init).then(resolve).catch(reject);
          }, 750);
          init?.signal?.addEventListener('abort', () => clearTimeout(id));
        });
      }
      return baseImpl(input, init);
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const employeeId = 'e-100';
    const locationId = 'loc-annual';

    const balanceHook = renderHook(() => useBalance(employeeId, locationId), {
      wrapper: makeWrapper(queryClient),
    });
    await waitFor(() => expect(balanceHook.result.current.data).toBeDefined());

    const before = balanceHook.result.current.data as Balance;

    const submitHook = renderHook(() => useSubmitRequest(), {
      wrapper: makeWrapper(queryClient),
    });

    submitHook.result.current.mutate({
      employeeId,
      locationId,
      days: 2,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    });

    await waitFor(() => {
      const optimistic = queryClient.getQueryData<Balance>(
        queryKeys.balance(employeeId, locationId),
      );
      expect(optimistic?.available).toBe(before.available - 2);
    });

    // Background refetch should not overwrite optimistic state due to in-flight guard.
    await balanceHook.result.current.refetch();

    const after = queryClient.getQueryData<Balance>(
      queryKeys.balance(employeeId, locationId),
    );
    expect(after?.available).toBe(before.available - 2);

    await waitFor(() => {
      expect(submitHook.result.current.isPending).toBe(false);
    });
  });
});

