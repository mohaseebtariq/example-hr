'use client';

import type { Balance } from '@/features/time-off/shared/types';
import { BalanceDisplay } from '@/features/time-off/shared/components/BalanceDisplay';
import { Button } from '@/features/time-off/shared/components/Button';
import { useRequestModalStore } from '@/store';

type BalanceRowProps = {
  balance: Balance;
  onRefresh: () => void;
};

export function BalanceRow({ balance, onRefresh }: BalanceRowProps) {
  const openModal = useRequestModalStore((s) => s.openModal);

  return (
    <div
      className="flex items-center justify-between p-5"
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex-1">
        <h3 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-1)' }}>
          {balance.locationName}
        </h3>
        <BalanceDisplay balance={balance} onRefresh={onRefresh} />
      </div>
      <Button
        onClick={() => openModal(balance.locationId)}
        variant="primary"
        style={{ marginLeft: 24, flexShrink: 0 }}
      >
        Request time off
      </Button>
    </div>
  );
}
