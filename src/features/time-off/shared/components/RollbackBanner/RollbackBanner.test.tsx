import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { RollbackBanner } from './RollbackBanner';

describe('RollbackBanner', () => {
  it('renders the provided reason', () => {
    render(<RollbackBanner reason="HCM did not record the deduction" onDismiss={() => {}} />);
    expect(screen.getByText('HCM did not record the deduction')).toBeInTheDocument();
  });

  it('renders a default message when no reason is provided', () => {
    render(<RollbackBanner onDismiss={() => {}} />);
    expect(screen.getByText(/could not be confirmed/i)).toBeInTheDocument();
  });

  it('always shows the "Request rolled back" heading', () => {
    render(<RollbackBanner onDismiss={() => {}} />);
    expect(screen.getByText('Request rolled back')).toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const handleDismiss = vi.fn();
    render(<RollbackBanner onDismiss={handleDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(handleDismiss).toHaveBeenCalledOnce();
  });

  it('has an alert role for accessibility', () => {
    render(<RollbackBanner onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
