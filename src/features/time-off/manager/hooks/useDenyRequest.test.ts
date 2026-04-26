import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { useDenyRequest } from './useDenyRequest';
import { hcmClient } from '@/lib/hcm-client';
import { queryKeys } from '@/lib/query-keys';

vi.mock('@/lib/hcm-client', () => ({
  hcmClient: { denyRequest: vi.fn() },
}));

const MANAGER_ID = 'm-100';
const VARIABLES = { requestId: 'req-xyz', employeeId: 'e-100', locationId: 'loc-annual' };

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
    queryClient,
  };
}

describe('useDenyRequest', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls hcmClient.denyRequest with the request ID', async () => {
    vi.mocked(hcmClient.denyRequest).mockResolvedValue({ status: 'denied', requestId: VARIABLES.requestId });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDenyRequest(MANAGER_ID), { wrapper });

    await act(async () => {
      result.current.mutate(VARIABLES);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hcmClient.denyRequest).toHaveBeenCalledWith(VARIABLES.requestId);
  });

  it('invalidates manager requests query on success', async () => {
    vi.mocked(hcmClient.denyRequest).mockResolvedValue({ status: 'denied', requestId: VARIABLES.requestId });
    const { wrapper, queryClient } = createWrapper();

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDenyRequest(MANAGER_ID), { wrapper });

    await act(async () => {
      result.current.mutate(VARIABLES);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.requests.manager(MANAGER_ID) }),
    );
  });

  it('invalidates balance and employee requests on success', async () => {
    vi.mocked(hcmClient.denyRequest).mockResolvedValue({ status: 'denied', requestId: VARIABLES.requestId });
    const { wrapper, queryClient } = createWrapper();

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDenyRequest(MANAGER_ID), { wrapper });

    await act(async () => {
      result.current.mutate(VARIABLES);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.balance(VARIABLES.employeeId, VARIABLES.locationId) }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.balances(VARIABLES.employeeId) }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.requests.employee(VARIABLES.employeeId) }),
    );
  });

  it('surfaces errors to the caller', async () => {
    vi.mocked(hcmClient.denyRequest).mockRejectedValue(new Error('Network failure'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDenyRequest(MANAGER_ID), { wrapper });

    await act(async () => {
      result.current.mutate(VARIABLES);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
