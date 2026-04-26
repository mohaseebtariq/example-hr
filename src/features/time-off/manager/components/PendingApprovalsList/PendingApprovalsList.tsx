'use client';

import { LoadingSkeleton } from '@/features/time-off/shared/components/LoadingSkeleton';
import { ApprovalCard } from '../ApprovalCard';
import { useManagerRequests } from '../../hooks/useManagerRequests';

type PendingApprovalsListProps = {
  managerId: string;
};

export function PendingApprovalsList({ managerId }: PendingApprovalsListProps) {
  const { data, isLoading, isError } = useManagerRequests(managerId);

  if (isLoading) return <LoadingSkeleton rows={3} />;

  if (isError) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load pending approvals. Please refresh the page.
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
        No pending requests.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((request) => (
        <ApprovalCard key={request.id} managerId={managerId} request={request} />
      ))}
    </div>
  );
}

