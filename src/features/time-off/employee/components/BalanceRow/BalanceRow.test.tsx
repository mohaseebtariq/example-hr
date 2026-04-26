import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { BalanceRow } from './BalanceRow';
import { useRequestModalStore } from '@/store';

const mockBalance = {
  employeeId: 'emp-1',
  locationId: 'loc-annual',
  locationName: 'Annual Leave',
  available: 15,
  pending: 0,
  fetchedAt: Date.now(),
};

describe('BalanceRow', () => {
  beforeEach(() => {
    useRequestModalStore.setState({ isOpen: false, locationId: null });
  });

  it('renders the leave type name', () => {
    render(<BalanceRow balance={mockBalance} onRefresh={vi.fn()} />);
    expect(screen.getByText('Annual Leave')).toBeDefined();
  });

  it('renders the available day count', () => {
    render(<BalanceRow balance={mockBalance} onRefresh={vi.fn()} />);
    expect(screen.getByText('15')).toBeDefined();
  });

  it('renders a request button', () => {
    render(<BalanceRow balance={mockBalance} onRefresh={vi.fn()} />);
    expect(screen.getByRole('button', { name: /request time off/i })).toBeDefined();
  });

  it('opens the modal with the correct locationId when the button is clicked', async () => {
    render(<BalanceRow balance={mockBalance} onRefresh={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /request time off/i }));

    const { isOpen, locationId } = useRequestModalStore.getState();
    expect(isOpen).toBe(true);
    expect(locationId).toBe('loc-annual');
  });

  it('calls onRefresh when the staleness refresh button is clicked', async () => {
    const onRefresh = vi.fn();
    const staleBalance = { ...mockBalance, fetchedAt: Date.now() - 120_000 };

    render(<BalanceRow balance={staleBalance} onRefresh={onRefresh} />);

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
