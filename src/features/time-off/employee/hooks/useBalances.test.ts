import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useBalances } from './useBalances';
import { hcmClient } from '@/lib/hcm-client';

vi.mock('@/lib/hcm-client', () => ({
  hcmClient: { getBalances: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = 'QueryClientProviderWrapper';
  return Wrapper;
}

const mockBalances = [
  { employeeId: 'emp-1', locationId: 'loc-annual', locationName: 'Annual Leave', available: 15, pending: 0, fetchedAt: Date.now() },
  { employeeId: 'emp-1', locationId: 'loc-sick',   locationName: 'Sick Leave',   available: 10, pending: 0, fetchedAt: Date.now() },
];

describe('useBalances', () => {
  beforeEach(() => {
    vi.mocked(hcmClient.getBalances).mockResolvedValue(mockBalances);
  });

  afterEach(() => vi.clearAllMocks());

  it('returns balances for the employee', async () => {
    const { result } = renderHook(() => useBalances('emp-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('calls getBalances with the correct employeeId', async () => {
    const { result } = renderHook(() => useBalances('emp-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hcmClient.getBalances).toHaveBeenCalledWith('emp-1');
  });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useBalances('emp-1'), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });
});
