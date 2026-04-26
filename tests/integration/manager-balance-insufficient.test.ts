// @vitest-environment jsdom
// Mandatory scenario 6 (CLAUDE.md §13): Manager approve → fresh balance < request.days → approval blocked in UI

import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

import { hcmStore } from '@/lib/mock-hcm/store';
import { seedStore } from '@/lib/mock-hcm/fixtures';
import { submitRequest } from '@/lib/mock-hcm/logic';
import type { TimeOffRequest } from '@/features/time-off/shared/types';
import { ApprovalCard } from '@/features/time-off/manager/components/ApprovalCard';
import { installMockHcmFetch } from './test-harness';

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('manager approval blocked when reservation is missing (integration)', () => {
  beforeEach(() => {
    seedStore(hcmStore);
    // Prevent silent-success from interfering with the submit setup step
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    installMockHcmFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('approve button is disabled when pending reservation < request.days', async () => {
    // Create a pending-manager request via the mock logic
    const submitResult = submitRequest(hcmStore, {
      employeeId: 'e-100',
      locationId: 'loc-annual',
      days: 5,
      startDate: '2026-07-01',
      endDate: '2026-07-05',
    });
    const requestId = (submitResult.body as { requestId: string }).requestId;
    const request = hcmStore.requests.get(requestId) as TimeOffRequest;

    const balanceKey = 'e-100:loc-annual';
    const bal = hcmStore.balances.get(balanceKey);
    if (bal) hcmStore.balances.set(balanceKey, { ...bal, pending: 0 });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(React.createElement(ApprovalCard, { managerId: 'm-100', request }), {
      wrapper: wrapper(queryClient),
    });

    // Wait for the live balance to load (LiveBalancePanel fetches on mount with staleTime:0)
    await screen.findByText(/unable to approve/i);

    // The Approve button must be disabled
    const approveButton = screen.getByRole('button', { name: 'Approve' });
    expect((approveButton as HTMLButtonElement).disabled).toBe(true);
  });
});
