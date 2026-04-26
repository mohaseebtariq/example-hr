import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { ApprovalCard } from './ApprovalCard';
import { hcmClient } from '@/lib/hcm-client';
import type { Balance, TimeOffRequest } from '@/features/time-off/shared/types';
import { queryKeys } from '@/lib/query-keys';

vi.mock('@/lib/hcm-client', () => ({
  hcmClient: {
    getBalance: vi.fn(),
    approveRequest: vi.fn(),
    denyRequest: vi.fn(),
  },
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

const pendingRequest: TimeOffRequest = {
  id: 'req-1',
  employeeId: 'e-100',
  locationId: 'loc-annual',
  days: 3,
  startDate: '2026-06-01',
  endDate: '2026-06-03',
  status: 'pending-manager',
};

const sufficientBalance: Balance = {
  employeeId: 'e-100',
  locationId: 'loc-annual',
  locationName: 'Annual Leave',
  available: 15,
  pending: 3,
  fetchedAt: Date.now(),
};

const insufficientBalance: Balance = {
  ...sufficientBalance,
  pending: 0,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
    queryClient,
  };
}

describe('ApprovalCard', () => {
  beforeEach(() => {
    vi.mocked(hcmClient.getBalance).mockResolvedValue(sufficientBalance);
  });

  afterEach(() => vi.clearAllMocks());

  it('renders employee and request info', async () => {
    const { wrapper } = createWrapper();

    render(React.createElement(ApprovalCard, { managerId: 'm-100', request: pendingRequest }), {
      wrapper,
    });

    expect(screen.getByText('Employee e-100')).toBeTruthy();
    expect(screen.getByText(/3 days/)).toBeTruthy();
  });

  it('always fetches live balance with staleTime: 0 on mount', async () => {
    const { wrapper } = createWrapper();

    render(React.createElement(ApprovalCard, { managerId: 'm-100', request: pendingRequest }), {
      wrapper,
    });

    await waitFor(() => {
      expect(hcmClient.getBalance).toHaveBeenCalledWith('e-100', 'loc-annual');
    });
  });

  it('enables Approve button when live balance is sufficient', async () => {
    const { wrapper } = createWrapper();

    render(React.createElement(ApprovalCard, { managerId: 'm-100', request: pendingRequest }), {
      wrapper,
    });

    const approveButton = await screen.findByRole('button', { name: 'Approve' });
    await waitFor(() => {
      expect((approveButton as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('disables Approve button and shows message when live balance is insufficient', async () => {
    vi.mocked(hcmClient.getBalance).mockResolvedValue(insufficientBalance);
    const { wrapper } = createWrapper();

    render(React.createElement(ApprovalCard, { managerId: 'm-100', request: pendingRequest }), {
      wrapper,
    });

    await screen.findByText(/unable to approve/i);

    const approveButton = screen.getByRole('button', { name: 'Approve' });
    expect((approveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens conflict modal on 409 BALANCE_CHANGED', async () => {
    const { HCMError: Err } = await import('@/lib/hcm-client');
    vi.mocked(hcmClient.approveRequest).mockRejectedValue(
      new Err(409, 'BALANCE_CHANGED', { currentBalance: 1 }),
    );

    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(queryKeys.balance('e-100', 'loc-annual'), sufficientBalance);

    render(
      React.createElement(ApprovalCard, { managerId: 'm-100', request: pendingRequest }),
      { wrapper },
    );

    const approveButton = await screen.findByRole('button', { name: 'Approve' });
    await waitFor(() => {
      expect((approveButton as HTMLButtonElement).disabled).toBe(false);
    });

    approveButton.click();

    await screen.findByText('Balance changed since request');
  });
});
