'use client';

import { StatusBadge } from '@/features/time-off/shared/components/StatusBadge';
import { RollbackBanner } from '@/features/time-off/shared/components/RollbackBanner';
import { LoadingSkeleton } from '@/features/time-off/shared/components/LoadingSkeleton';
import type { TimeOffRequest } from '@/features/time-off/shared/types';
import { useEmployeeRequests } from '../../hooks/useEmployeeRequests';

type ActiveRequestsListProps = {
  employeeId: string;
};

function RequestStatusCard({ request }: { request: TimeOffRequest }) {
  const dateLabel =
    request.startDate === request.endDate
      ? request.startDate
      : `${request.startDate} → ${request.endDate}`;

  const rollbackReason =
    request.hcmRejectionReason ??
    (request.status === 'rolled-back'
      ? 'HCM did not record the deduction. Your balance was unchanged.'
      : undefined);

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--ink-1)' }}
          >
            {request.days} day{request.days !== 1 ? 's' : ''} · {dateLabel}
          </p>
          <p
            className="mt-0.5 text-xs"
            style={{ color: 'var(--ink-3)' }}
          >
            Location {request.locationId}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {request.status === 'rolled-back' && rollbackReason && (
        <RollbackBanner reason={rollbackReason} />
      )}
    </div>
  );
}

export function ActiveRequestsList({ employeeId }: ActiveRequestsListProps) {
  const { data: requests, isLoading, isError } = useEmployeeRequests(employeeId);

  if (isLoading) return <LoadingSkeleton rows={2} />;

  if (isError) {
    return (
      <p
        className="rounded-md p-4 text-sm"
        style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--ink-2)',
        }}
      >
        Failed to load your requests.
      </p>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <p
        className="rounded-md p-4 text-sm"
        style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--ink-2)',
        }}
      >
        No requests yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((request) => (
        <RequestStatusCard key={request.id} request={request} />
      ))}
    </div>
  );
}
