import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from './StatusBadge';
import type { RequestStatus } from '@/features/time-off/shared/types';

const STATUS_LABELS: Record<RequestStatus, string> = {
  draft:             'Draft',
  'pending-hcm':     'Submitting…',
  'pending-manager': 'Pending approval',
  approved:          'Approved',
  denied:            'Denied',
  'rolled-back':     'Rolled back',
};

describe('StatusBadge', () => {
  for (const [status, expectedLabel] of Object.entries(STATUS_LABELS) as [RequestStatus, string][]) {
    it(`renders "${expectedLabel}" for status "${status}"`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });
  }

  it('never shows "Approved" for pending-manager status (core design contract)', () => {
    render(<StatusBadge status="pending-manager" />);
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  });
});
