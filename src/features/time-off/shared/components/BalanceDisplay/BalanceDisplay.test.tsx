import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BalanceDisplay } from './BalanceDisplay';
import type { Balance } from '@/features/time-off/shared/types';

function makeBalance(overrides?: Partial<Balance>): Balance {
  return {
    employeeId: 'emp-1',
    locationId: 'loc-annual',
    locationName: 'Annual Leave',
    available: 15,
    pending: 0,
    fetchedAt: Date.now(),
    ...overrides,
  };
}

describe('BalanceDisplay', () => {
  it('renders the available day count', () => {
    render(<BalanceDisplay balance={makeBalance({ available: 12 })} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders "days available" label', () => {
    render(<BalanceDisplay balance={makeBalance()} />);
    expect(screen.getByText('days available')).toBeInTheDocument();
  });

  it('renders pending days when pending > 0', () => {
    render(<BalanceDisplay balance={makeBalance({ pending: 3 })} />);
    expect(screen.getByText(/3 days pending confirmation/)).toBeInTheDocument();
  });

  it('renders singular "day" for pending = 1', () => {
    render(<BalanceDisplay balance={makeBalance({ pending: 1 })} />);
    expect(screen.getByText(/1 day pending confirmation/)).toBeInTheDocument();
  });

  it('does not render pending section when pending = 0', () => {
    render(<BalanceDisplay balance={makeBalance({ pending: 0 })} />);
    expect(screen.queryByText(/pending confirmation/)).not.toBeInTheDocument();
  });

  it('does not show staleness indicator when fetchedAt is recent', () => {
    render(<BalanceDisplay balance={makeBalance({ fetchedAt: Date.now() })} />);
    expect(screen.queryByText(/Balance as of/)).not.toBeInTheDocument();
  });

  it('shows staleness indicator when fetchedAt is old', () => {
    render(<BalanceDisplay balance={makeBalance({ fetchedAt: Date.now() - 120_000 })} />);
    expect(screen.getByText(/Balance as of/)).toBeInTheDocument();
  });

  it('passes onRefresh through to the staleness indicator', async () => {
    const handleRefresh = vi.fn();
    render(
      <BalanceDisplay
        balance={makeBalance({ fetchedAt: Date.now() - 120_000 })}
        onRefresh={handleRefresh}
      />,
    );
    expect(screen.getByRole('button', { name: /refresh balance/i })).toBeInTheDocument();
  });
});
