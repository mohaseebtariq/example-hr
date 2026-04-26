import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useBalance } from './useBalance';
import { hcmClient } from '@/lib/hcm-client';
import { useInFlightMutationsStore, useNotificationsStore } from '@/store';
import { queryKeys } from '@/lib/query-keys';

vi.mock('@/lib/hcm-client', () => ({
  hcmClient: { getBalance: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

const freshBalance = {
  employeeId: 'emp-1', locationId: 'loc-annual',
  locationName: 'Annual Leave', available: 15, pending: 0, fetchedAt: Date.now(),
};

describe('useBalance', () => {
  beforeEach(() => {
    vi.mocked(hcmClient.getBalance).mockResolvedValue({ ...freshBalance });
    useInFlightMutationsStore.setState({ mutations: new Set() });
    useNotificationsStore.setState({ queue: [] });
  });

  afterEach(() => vi.clearAllMocks());

  it('fetches and returns balance data', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useBalance('emp-1', 'loc-annual'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.available).toBe(15);
  });

  it('in-flight guard: returns cached value when mutation is in-flight', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useBalance('emp-1', 'loc-annual'),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Register mutation as in-flight
    act(() => useInFlightMutationsStore.getState().add('emp-1:loc-annual'));

    // Update mock to return different data (simulating background poll)
    vi.mocked(hcmClient.getBalance).mockResolvedValue({ ...freshBalance, available: 5 });

    // The queryFn should return cached value, not the new mock value
    await waitFor(() => {
      expect(result.current.data?.available).toBe(15);
    });
  });

  it('dispatches balance-refreshed-up notification when balance increases', async () => {
    vi.mocked(hcmClient.getBalance).mockResolvedValueOnce({ ...freshBalance, available: 15 });

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(
      () => useBalance('emp-1', 'loc-annual'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Simulate anniversary bonus — next fetch returns higher balance
    vi.mocked(hcmClient.getBalance).mockResolvedValue({ ...freshBalance, available: 20, fetchedAt: Date.now() + 1000 });

    // Explicit invalidation triggers a background re-fetch (more reliable than rerender)
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: queryKeys.balance('emp-1', 'loc-annual') });
    });
    await waitFor(() => expect(result.current.data?.available).toBe(20));

    const { queue } = useNotificationsStore.getState();
    const notification = queue.find((n) => n.type === 'balance-refreshed-up');
    expect(notification).toBeDefined();
    expect(notification?.message).toMatch(/updated to 20 days/);
  });

  it('dispatches balance-refreshed-down notification when balance decreases without in-flight mutation', async () => {
    vi.mocked(hcmClient.getBalance).mockResolvedValueOnce({ ...freshBalance, available: 15 });

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(
      () => useBalance('emp-1', 'loc-annual'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    vi.mocked(hcmClient.getBalance).mockResolvedValue({ ...freshBalance, available: 8, fetchedAt: Date.now() + 1000 });

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: queryKeys.balance('emp-1', 'loc-annual') });
    });
    await waitFor(() => expect(result.current.data?.available).toBe(8));

    const { queue } = useNotificationsStore.getState();
    const notification = queue.find((n) => n.type === 'balance-refreshed-down');
    expect(notification).toBeDefined();
    expect(notification?.message).toMatch(/reduced to 8 days/);
  });

  it('does NOT dispatch notification when in-flight mutation is active', async () => {
    vi.mocked(hcmClient.getBalance).mockResolvedValue({ ...freshBalance });

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(
      () => useBalance('emp-1', 'loc-annual'),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => useInFlightMutationsStore.getState().add('emp-1:loc-annual'));

    vi.mocked(hcmClient.getBalance).mockResolvedValue({ ...freshBalance, available: 20 });

    // Attempt a refetch while mutation is in-flight — guard should suppress the new data
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: queryKeys.balance('emp-1', 'loc-annual') });
    });

    const { queue } = useNotificationsStore.getState();
    expect(queue.filter((n) => n.type === 'balance-refreshed-up')).toHaveLength(0);
  });
});
