import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { RequestModal } from './RequestModal';
import { hcmClient } from '@/lib/hcm-client';
import { useRequestModalStore, useInFlightMutationsStore } from '@/store';
import { queryKeys } from '@/lib/query-keys';
import type { Balance } from '@/features/time-off/shared/types';

vi.mock('@/lib/hcm-client', () => ({
  hcmClient: {
    getBalance: vi.fn(),
    submitRequest: vi.fn(),
  },
}));

const EMPLOYEE_ID = 'emp-1';
const LOCATION_ID = 'loc-annual';

const mockBalance: Balance = {
  employeeId: EMPLOYEE_ID,
  locationId: LOCATION_ID,
  locationName: 'Annual Leave',
  available: 15,
  pending: 0,
  fetchedAt: Date.now(),
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.balance(EMPLOYEE_ID, LOCATION_ID), mockBalance);
  return { ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>), queryClient };
}

function openModal() {
  useRequestModalStore.setState({ isOpen: true, locationId: LOCATION_ID });
}

describe('RequestModal', () => {
  beforeEach(() => {
    vi.mocked(hcmClient.getBalance).mockResolvedValue({ ...mockBalance });
    vi.mocked(hcmClient.submitRequest).mockResolvedValue({ requestId: 'req-1', status: 'accepted' });
    useRequestModalStore.setState({ isOpen: false, locationId: null });
    useInFlightMutationsStore.setState({ mutations: new Set() });
  });

  afterEach(() => vi.clearAllMocks());

  it('renders nothing when the modal is closed', () => {
    renderWithClient(<RequestModal employeeId={EMPLOYEE_ID} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog when the modal is open', async () => {
    renderWithClient(<RequestModal employeeId={EMPLOYEE_ID} />);
    act(() => openModal());
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
  });

  it('shows the leave type name from the balance', async () => {
    renderWithClient(<RequestModal employeeId={EMPLOYEE_ID} />);
    act(() => openModal());
    await waitFor(() => expect(screen.getByText('Annual Leave')).toBeDefined());
  });

  it('shows the available day count', async () => {
    renderWithClient(<RequestModal employeeId={EMPLOYEE_ID} />);
    act(() => openModal());
    await waitFor(() => {
      expect(
        screen.getByText((_, el) => el?.textContent === '15 days available'),
      ).toBeDefined();
    });
  });

  it('submit button is disabled when no dates are selected', async () => {
    renderWithClient(<RequestModal employeeId={EMPLOYEE_ID} />);
    act(() => openModal());
    await waitFor(() => screen.getByRole('button', { name: /submit request/i }));
    const submitBtn = screen.getByRole('button', { name: /submit request/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit button is disabled when days exceed available balance (Gap B pre-validation)', async () => {
    renderWithClient(<RequestModal employeeId={EMPLOYEE_ID} />);
    act(() => openModal());
    await waitFor(() => screen.getByLabelText(/start date/i));

    await userEvent.type(screen.getByLabelText(/start date/i), '2026-06-01');
    await userEvent.type(screen.getByLabelText(/end date/i), '2026-06-30'); // 30 days > 15 available

    await waitFor(() => {
      const submitBtn = screen.getByRole('button', { name: /submit request/i });
      expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    });
    expect(screen.getByText(/insufficient balance/i)).toBeDefined();
  });

  it('closes when the Cancel button is clicked', async () => {
    renderWithClient(<RequestModal employeeId={EMPLOYEE_ID} />);
    act(() => openModal());
    await waitFor(() => screen.getByRole('button', { name: /cancel/i }));

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(useRequestModalStore.getState().isOpen).toBe(false);
  });

  it('closes when the ✕ button is clicked', async () => {
    renderWithClient(<RequestModal employeeId={EMPLOYEE_ID} />);
    act(() => openModal());
    await waitFor(() => screen.getByRole('button', { name: /close modal/i }));

    await userEvent.click(screen.getByRole('button', { name: /close modal/i }));
    expect(useRequestModalStore.getState().isOpen).toBe(false);
  });
});
