import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { useApproveRequest } from './useApproveRequest';
import { hcmClient, HCMError } from '@/lib/hcm-client';
import { queryKeys } from '@/lib/query-keys';

vi.mock('@/lib/hcm-client', () => ({
  hcmClient: { approveRequest: vi.fn() },
  HCMError: class HCMError extends Error {
    status: number;
    code: string;
    data: Record<string, unknown>;
    constructor(status: number, code: string, data = {}) {
      super(code);
      this.name = 'HCMError';
      this.status = status;
      this.code = code;
      this.data = data;
    }
  },
}));

const MANAGER_ID = 'm-100';
const VARIABLES = { requestId: 'req-abc', employeeId: 'e-100', locationId: 'loc-annual' };

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

describe('useApproveRequest', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls hcmClient.approveRequest with the request ID', async () => {
    vi.mocked(hcmClient.approveRequest).mockResolvedValue({ status: 'approved', requestId: VARIABLES.requestId });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useApproveRequest(MANAGER_ID), { wrapper });

    await act(async () => {
      result.current.mutate(VARIABLES);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hcmClient.approveRequest).toHaveBeenCalledWith(VARIABLES.requestId);
  });

  it('invalidates manager requests query on success', async () => {
    vi.mocked(hcmClient.approveRequest).mockResolvedValue({ status: 'approved', requestId: VARIABLES.requestId });
    const { wrapper, queryClient } = createWrapper();

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useApproveRequest(MANAGER_ID), { wrapper });

    await act(async () => {
      result.current.mutate(VARIABLES);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.requests.manager(MANAGER_ID) }),
    );
  });

  it('invalidates balance and employee requests on success', async () => {
    vi.mocked(hcmClient.approveRequest).mockResolvedValue({ status: 'approved', requestId: VARIABLES.requestId });
    const { wrapper, queryClient } = createWrapper();

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useApproveRequest(MANAGER_ID), { wrapper });

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

  it('surfaces HCMError 409 BALANCE_CHANGED to the caller', async () => {
    const { HCMError: Err } = await import('@/lib/hcm-client');
    vi.mocked(hcmClient.approveRequest).mockRejectedValue(
      new Err(409, 'BALANCE_CHANGED', { currentBalance: 1 }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useApproveRequest(MANAGER_ID), { wrapper });

    await act(async () => {
      result.current.mutate(VARIABLES);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(HCMError);
    expect((result.current.error as InstanceType<typeof HCMError>).code).toBe('BALANCE_CHANGED');
  });
});
