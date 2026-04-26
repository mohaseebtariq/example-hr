// @vitest-environment jsdom

import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { hcmStore } from '@/lib/mock-hcm/store';
import { seedStore } from '@/lib/mock-hcm/fixtures';
import { triggerAnniversary } from '@/lib/mock-hcm/logic';
import { useBalance } from '@/features/time-off/employee/hooks/useBalance';
import { useNotificationsStore } from '@/store';
import { installMockHcmFetch } from './test-harness';

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('out-of-band balance change notification (integration)', () => {
  beforeEach(() => {
    seedStore(hcmStore);
    useNotificationsStore.setState({ queue: [] });
    installMockHcmFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('background refetch returns higher balance → toast dispatched', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const employeeId = 'e-100';
    const locationId = 'loc-annual';

    const { result } = renderHook(
      () => useBalance(employeeId, locationId, { staleTime: 0, refetchOnMount: 'always' }),
      { wrapper: makeWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    triggerAnniversary(hcmStore, { employeeId, locationId, bonusDays: 5 });

    await result.current.refetch();

    await waitFor(() => {
      const notifications = useNotificationsStore.getState().queue;
      expect(notifications.some((n) => n.type === 'balance-refreshed-up')).toBe(true);
    });
  });
});

