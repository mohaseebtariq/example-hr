import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StalenessIndicator, VISIBLE_STALENESS_THRESHOLD_MS } from './StalenessIndicator';

afterEach(() => vi.useRealTimers());

describe('StalenessIndicator', () => {
  it('does not render when fetchedAt is within the threshold', () => {
    const recentFetchedAt = Date.now() - 30_000;
    render(<StalenessIndicator fetchedAt={recentFetchedAt} />);
    expect(screen.queryByText(/Balance as of/)).not.toBeInTheDocument();
  });

  it('renders when fetchedAt exceeds the threshold', () => {
    const staleFetchedAt = Date.now() - (VISIBLE_STALENESS_THRESHOLD_MS + 10_000);
    render(<StalenessIndicator fetchedAt={staleFetchedAt} />);
    expect(screen.getByText(/Balance as of/)).toBeInTheDocument();
  });

  it('shows "1 min ago" when just over 1 minute old', () => {
    const fetchedAt = Date.now() - 70_000;
    render(<StalenessIndicator fetchedAt={fetchedAt} />);
    expect(screen.getByText('Balance as of 1 min ago')).toBeInTheDocument();
  });

  it('shows correct plural minutes when older', () => {
    const fetchedAt = Date.now() - 180_000; // 3 minutes ago
    render(<StalenessIndicator fetchedAt={fetchedAt} />);
    expect(screen.getByText('Balance as of 3 min ago')).toBeInTheDocument();
  });

  it('renders a refresh button when onRefresh is provided', () => {
    const fetchedAt = Date.now() - 120_000;
    render(<StalenessIndicator fetchedAt={fetchedAt} onRefresh={() => {}} />);
    expect(screen.getByRole('button', { name: /refresh balance/i })).toBeInTheDocument();
  });

  it('does not render a refresh button when onRefresh is omitted', () => {
    const fetchedAt = Date.now() - 120_000;
    render(<StalenessIndicator fetchedAt={fetchedAt} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRefresh when the refresh button is clicked', async () => {
    const handleRefresh = vi.fn();
    const fetchedAt = Date.now() - 120_000;
    render(<StalenessIndicator fetchedAt={fetchedAt} onRefresh={handleRefresh} />);

    await userEvent.click(screen.getByRole('button', { name: /refresh balance/i }));
    expect(handleRefresh).toHaveBeenCalledOnce();
  });

  it('threshold constant is 60 seconds', () => {
    expect(VISIBLE_STALENESS_THRESHOLD_MS).toBe(60_000);
  });
});
