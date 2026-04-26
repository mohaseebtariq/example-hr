import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingSkeleton } from './LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renders 3 skeleton rows by default', () => {
    const { container } = render(<LoadingSkeleton />);
    const rows = container.querySelectorAll('.animate-pulse');
    expect(rows).toHaveLength(3);
  });

  it('renders the specified number of rows', () => {
    const { container } = render(<LoadingSkeleton rows={5} />);
    const rows = container.querySelectorAll('.animate-pulse');
    expect(rows).toHaveLength(5);
  });

  it('renders 1 row when rows=1', () => {
    const { container } = render(<LoadingSkeleton rows={1} />);
    const rows = container.querySelectorAll('.animate-pulse');
    expect(rows).toHaveLength(1);
  });

  it('has a status role for accessibility', () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has a screen-reader loading label', () => {
    render(<LoadingSkeleton />);
    expect(screen.getByText(/Loading balances/)).toBeInTheDocument();
  });
});
