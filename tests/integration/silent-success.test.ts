// @vitest-environment jsdom

import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

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

describe('silent success detection (integration)', () => {
  beforeEach(() => {
    seedStore(hcmStore);
    useNotificationsStore.setState({ queue: [] });
    installMockHcmFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('submit request → HCM 200 but balance unchanged → rollback + notification', async () => {
    // Force silent-success path in mock logic (20% probability)
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const employeeId = 'e-100';
    const locationId = 'loc-annual';

    // Prime cache so the mutation has a snapshot to restore to
    const before = await queryClient.fetchQuery<Balance>({
      queryKey: queryKeys.balance(employeeId, locationId),
      queryFn: async () =>
        (await (await fetch(`/api/mock/hcm/balance?employeeId=${employeeId}&locationId=${locationId}`)).json()) as Balance,
    });

    const { result } = renderHook(() => useSubmitRequest(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({
      employeeId,
      locationId,
      days: 2,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    const after = queryClient.getQueryData<Balance>(
      queryKeys.balance(employeeId, locationId),
    );

    expect(after?.available).toBe(before.available);
    expect(after?.pending).toBe(before.pending);

    const notifications = useNotificationsStore.getState().queue;
    expect(notifications.some((n) => n.type === 'rollback')).toBe(true);
  });
});

