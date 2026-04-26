import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { BalanceSummaryGrid } from './BalanceSummaryGrid';
import { hcmClient } from '@/lib/hcm-client';
import { useRequestModalStore } from '@/store';

vi.mock('@/lib/hcm-client', () => ({
  hcmClient: { getBalances: vi.fn() },
}));

const mockBalances = [
  { employeeId: 'emp-1', locationId: 'loc-annual', locationName: 'Annual Leave', available: 15, pending: 0, fetchedAt: Date.now() },
  { employeeId: 'emp-1', locationId: 'loc-sick',   locationName: 'Sick Leave',   available: 10, pending: 2, fetchedAt: Date.now() },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('BalanceSummaryGrid', () => {
  beforeEach(() => {
    vi.mocked(hcmClient.getBalances).mockResolvedValue(mockBalances);
    useRequestModalStore.setState({ isOpen: false, locationId: null });
  });

  afterEach(() => vi.clearAllMocks());

  it('shows a loading skeleton while fetching', () => {
    vi.mocked(hcmClient.getBalances).mockImplementation(() => new Promise(() => {}));
    renderWithClient(<BalanceSummaryGrid employeeId="emp-1" />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('renders a row for each leave type', async () => {
    renderWithClient(<BalanceSummaryGrid employeeId="emp-1" />);

    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeDefined());
    expect(screen.getByText('Sick Leave')).toBeDefined();
  });

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(hcmClient.getBalances).mockRejectedValue(new Error('network error'));
    renderWithClient(<BalanceSummaryGrid employeeId="emp-1" />);

    await waitFor(() =>
      expect(screen.getByText(/Failed to load leave balances/i)).toBeDefined(),
    );
  });

  it('renders available day counts for each balance', async () => {
    renderWithClient(<BalanceSummaryGrid employeeId="emp-1" />);

    await waitFor(() => expect(screen.getByText('15')).toBeDefined());
    expect(screen.getByText('10')).toBeDefined();
  });
});
