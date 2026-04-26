// @vitest-environment jsdom

import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

describe('manager approval conflict (integration)', () => {
  beforeEach(() => {
    seedStore(hcmStore);
    installMockHcmFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('approve → 409 BALANCE_CHANGED → conflict modal opens', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    // Create a real pending-manager request in the store
    const submit = submitRequest(hcmStore, {
      employeeId: 'e-100',
      locationId: 'loc-annual',
      days: 2,
      startDate: '2026-06-01',
      endDate: '2026-06-02',
    });
    const requestId = (submit.body as { requestId: string }).requestId;

    const request = hcmStore.requests.get(requestId) as TimeOffRequest;

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(React.createElement(ApprovalCard, { managerId: 'm-100', request }), {
      wrapper: wrapper(queryClient),
    });

    // Ensure the initial live balance read includes the pending reservation so approve enables.
    const annualKey = `e-100:loc-annual`;
    const bal = hcmStore.balances.get(annualKey);
    if (bal) hcmStore.balances.set(annualKey, { ...bal, available: 10, pending: 2 });

    await queryClient.invalidateQueries();

    const approveButton = await screen.findByRole('button', { name: 'Approve' });
    await waitFor(() => {
      expect((approveButton as HTMLButtonElement).disabled).toBe(false);
    });

    // Now simulate an out-of-band reservation loss between review and click.
    const bal2 = hcmStore.balances.get(annualKey);
    if (bal2) hcmStore.balances.set(annualKey, { ...bal2, pending: 0 });

    const user = userEvent.setup();
    await user.click(approveButton);

    expect(await screen.findByText('Balance changed since request')).toBeTruthy();
  });
});

