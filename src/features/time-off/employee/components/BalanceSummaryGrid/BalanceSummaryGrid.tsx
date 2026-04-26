'use client';

import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { LoadingSkeleton } from '@/features/time-off/shared/components/LoadingSkeleton';
import { useBalances } from '../../hooks/useBalances';
import { BalanceRow } from '../BalanceRow';

type BalanceSummaryGridProps = {
  employeeId: string;
};

export function BalanceSummaryGrid({ employeeId }: BalanceSummaryGridProps) {
  const queryClient = useQueryClient();
  const { data: balances, isLoading, isError } = useBalances(employeeId);

  if (isLoading) return <LoadingSkeleton rows={3} />;

  if (isError) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load leave balances. Please refresh the page.
      </p>
    );
  }

  if (!balances || balances.length === 0) {
    return (
      <p
        className="p-4 text-sm"
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--ink-2)',
        }}
      >
        No balances found for this employee.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {balances.map((balance) => (
        <BalanceRow
          key={balance.locationId}
          balance={balance}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.balance(employeeId, balance.locationId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.balances(employeeId) });
          }}
        />
      ))}
    </div>
  );
}
