'use client';

import type { RequestStatus } from '@/features/time-off/shared/types';

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  draft: {
    label: 'Draft',
    color: 'var(--status-info)',
    bg: 'var(--status-info-bg)',
    border: 'var(--status-info-border)',
  },
  'pending-hcm': {
    label: 'Submitting…',
    color: 'var(--status-optimistic)',
    bg: 'var(--status-optimistic-bg)',
    border: 'var(--status-optimistic-border)',
  },
  'pending-manager': {
    label: 'Pending approval',
    color: 'var(--status-pending)',
    bg: 'var(--status-pending-bg)',
    border: 'var(--status-pending-border)',
  },
  approved: {
    label: 'Approved',
    color: 'var(--status-approved)',
    bg: 'var(--status-approved-bg)',
    border: 'var(--status-approved-border)',
  },
  denied: {
    label: 'Denied',
    color: 'var(--status-denied)',
    bg: 'var(--status-denied-bg)',
    border: 'var(--status-denied-border)',
  },
  'rolled-back': {
    label: 'Rolled back',
    color: 'var(--status-rollback)',
    bg: 'var(--status-rollback-bg)',
    border: 'var(--status-rollback-border)',
  },
};

type StatusBadgeProps = {
  status: RequestStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, color, bg, border } = STATUS_CONFIG[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 'var(--radius-xs)',
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
