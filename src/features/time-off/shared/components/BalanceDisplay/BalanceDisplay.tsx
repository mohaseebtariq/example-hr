'use client';

import type { Balance } from '@/features/time-off/shared/types';
import { StalenessIndicator } from '../StalenessIndicator';

type BalanceDisplayProps = {
  balance: Balance;
  onRefresh?: () => void;
};

export function BalanceDisplay({ balance, onRefresh }: BalanceDisplayProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--ink-1)',
            lineHeight: 1.1,
          }}
        >
          {balance.available}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>days available</span>
      </div>

      {balance.pending > 0 && (
        <p style={{ fontSize: 12, color: 'var(--status-pending)' }}>
          {balance.pending} day{balance.pending !== 1 ? 's' : ''} pending confirmation
        </p>
      )}

      <StalenessIndicator fetchedAt={balance.fetchedAt} onRefresh={onRefresh} />
    </div>
  );
}
