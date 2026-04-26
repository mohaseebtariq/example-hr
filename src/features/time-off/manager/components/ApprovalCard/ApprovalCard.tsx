'use client';

import { useMemo, useState } from 'react';
import type { TimeOffRequest } from '@/features/time-off/shared/types';
import { HCMError } from '@/lib/hcm-client';
import { useNotificationsStore } from '@/store';
import { useBalance } from '@/features/time-off/employee/hooks/useBalance';
import { queryKeys } from '@/lib/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/features/time-off/shared/components/Button';
import { useApproveRequest } from '../../hooks/useApproveRequest';
import { useDenyRequest } from '../../hooks/useDenyRequest';
import { LiveBalancePanel } from '../LiveBalancePanel';
import { ApprovalConflictModal } from '../ApprovalConflictModal';

type ApprovalCardProps = {
  managerId: string;
  request: TimeOffRequest;
};

export function ApprovalCard({ managerId, request }: ApprovalCardProps) {
  const queryClient = useQueryClient();
  const approve = useApproveRequest(managerId);
  const deny = useDenyRequest(managerId);

  // staleTime: 0 — manager must never approve on a cached balance
  const {
    data: liveBalance,
    isLoading: isLiveBalanceLoading,
    isError: isLiveBalanceError,
  } = useBalance(request.employeeId, request.locationId, {
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const [isConflictOpen, setIsConflictOpen] = useState(false);
  const [conflictBalance, setConflictBalance] = useState<number>(0);

  const dateLabel = useMemo(() => {
    if (request.startDate === request.endDate) return request.startDate;
    return `${request.startDate} → ${request.endDate}`;
  }, [request.startDate, request.endDate]);

  const isBusy = approve.isPending || deny.isPending;
  const canApprove =
    !isLiveBalanceLoading &&
    !isLiveBalanceError &&
    !!liveBalance &&
    liveBalance.pending >= request.days;

  async function handleApprove() {
    try {
      await approve.mutateAsync({
        requestId: request.id,
        employeeId: request.employeeId,
        locationId: request.locationId,
      });
    } catch (e) {
      if (e instanceof HCMError && e.status === 409 && e.code === 'BALANCE_CHANGED') {
        const currentBalance =
          typeof e.data.currentBalance === 'number' ? e.data.currentBalance : 0;
        setConflictBalance(currentBalance);
        setIsConflictOpen(true);
        return;
      }
      if (e instanceof HCMError && e.status === 404 && e.code === 'NOT_FOUND') {
        useNotificationsStore.getState().push({
          key: `manager-approve-not-found-${request.id}`,
          type: 'error',
          message:
            'This request is no longer available. Refreshing the approvals list.',
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.manager(managerId) });
        queryClient.invalidateQueries({
          queryKey: queryKeys.requests.employee(request.employeeId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.balances(request.employeeId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.balance(request.employeeId, request.locationId),
        });
        approve.reset();
        return;
      }
      useNotificationsStore.getState().push({
        key: `manager-approve-error-${request.id}-${Date.now()}`,
        type: 'error',
        message: 'Could not approve this request. Please try again.',
      });
    }
  }

  async function handleDeny() {
    try {
      await deny.mutateAsync({
        requestId: request.id,
        employeeId: request.employeeId,
        locationId: request.locationId,
      });
    } catch (e) {
      if (e instanceof HCMError && e.status === 404 && e.code === 'NOT_FOUND') {
        useNotificationsStore.getState().push({
          key: `manager-deny-not-found-${request.id}`,
          type: 'error',
          message:
            'This request is no longer available. Refreshing the approvals list.',
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.requests.manager(managerId) });
        queryClient.invalidateQueries({
          queryKey: queryKeys.requests.employee(request.employeeId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.balances(request.employeeId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.balance(request.employeeId, request.locationId),
        });
        deny.reset();
        return;
      }
      useNotificationsStore.getState().push({
        key: `manager-deny-error-${request.id}-${Date.now()}`,
        type: 'error',
        message: 'Could not deny this request. Please try again.',
      });
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Employee {request.employeeId}
              </p>
              <p className="mt-1 text-sm text-gray-700">
                {request.days} days · {dateLabel}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Location {request.locationId}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <LiveBalancePanel
              requiredDays={request.days}
              balance={liveBalance}
              isLoading={isLiveBalanceLoading}
              isError={isLiveBalanceError}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-row gap-3 md:flex-col">
          <Button
            onClick={handleApprove}
            disabled={isBusy || !canApprove}
            variant="primary"
            isLoading={approve.isPending}
          >
            Approve
          </Button>
          <Button
            onClick={handleDeny}
            disabled={isBusy}
            variant="secondary"
            isLoading={deny.isPending}
          >
            Deny
          </Button>
        </div>
      </div>

      <ApprovalConflictModal
        isOpen={isConflictOpen}
        currentBalance={conflictBalance}
        onClose={() => setIsConflictOpen(false)}
      />
    </div>
  );
}

