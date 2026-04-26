import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConflictBanner } from './ConflictBanner';

describe('ConflictBanner', () => {
  it('renders the provided message', () => {
    render(<ConflictBanner message="Your balance was reduced externally." />);
    expect(screen.getByText('Your balance was reduced externally.')).toBeInTheDocument();
  });

  it('renders a dismiss button when onDismiss is provided', () => {
    render(<ConflictBanner message="Conflict." onDismiss={() => {}} />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('does not render a dismiss button when onDismiss is omitted', () => {
    render(<ConflictBanner message="Conflict." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onDismiss when the button is clicked', async () => {
    const handleDismiss = vi.fn();
    render(<ConflictBanner message="Conflict." onDismiss={handleDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(handleDismiss).toHaveBeenCalledOnce();
  });

  it('has an alert role for accessibility', () => {
    render(<ConflictBanner message="Conflict." />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
