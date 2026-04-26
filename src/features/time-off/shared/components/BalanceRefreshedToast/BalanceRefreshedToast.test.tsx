import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BalanceRefreshedToast } from './BalanceRefreshedToast';

describe('BalanceRefreshedToast', () => {
  it('shows updated balance message for balance-refreshed-up', () => {
    render(
      <BalanceRefreshedToast
        type="balance-refreshed-up"
        locationName="Annual Leave"
        newAvailable={20}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/Annual Leave balance was updated to 20 days/)).toBeInTheDocument();
  });

  it('shows reduced balance message for balance-refreshed-down', () => {
    render(
      <BalanceRefreshedToast
        type="balance-refreshed-down"
        locationName="Annual Leave"
        newAvailable={8}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/Annual Leave balance was reduced to 8 days/)).toBeInTheDocument();
  });

  it('mentions "external update" for balance-refreshed-down', () => {
    render(
      <BalanceRefreshedToast
        type="balance-refreshed-down"
        locationName="Annual Leave"
        newAvailable={8}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/external update/)).toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const handleDismiss = vi.fn();
    render(
      <BalanceRefreshedToast
        type="balance-refreshed-up"
        locationName="Annual Leave"
        newAvailable={20}
        onDismiss={handleDismiss}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(handleDismiss).toHaveBeenCalledOnce();
  });

  it('has a status role for accessibility', () => {
    render(
      <BalanceRefreshedToast
        type="balance-refreshed-up"
        locationName="Annual Leave"
        newAvailable={20}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
