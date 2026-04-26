'use client';

import { BalanceDisplay } from '@/features/time-off/shared/components/BalanceDisplay';
import { LoadingSkeleton } from '@/features/time-off/shared/components/LoadingSkeleton';
import type { Balance } from '@/features/time-off/shared/types';

type LiveBalancePanelProps = {
  balance?: Balance;
  isLoading: boolean;
  isError: boolean;
  requiredDays: number;
};

export function LiveBalancePanel({
  balance,
  requiredDays,
  isLoading,
  isError,
}: LiveBalancePanelProps) {
  if (isLoading) return <LoadingSkeleton rows={1} />;

  if (isError || !balance) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Failed to load live balance.
      </p>
    );
  }

  const canApprove = balance.pending >= requiredDays;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-600">Live balance</p>
        {!canApprove && (
          <p className="text-xs font-medium text-red-700">
            Unable to approve (reservation missing)
          </p>
        )}
      </div>
      <BalanceDisplay
        balance={balance}
        onRefresh={() => {}}
      />
    </div>
  );
}

