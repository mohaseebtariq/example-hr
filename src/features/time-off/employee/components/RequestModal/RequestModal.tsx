'use client';

import { useState, useEffect } from 'react';
import { useRequestModalStore } from '@/store';
import { useBalance } from '../../hooks/useBalance';
import { useSubmitRequest } from '../../hooks/useSubmitRequest';
import { DateRangePicker } from './DateRangePicker';
import { DayCountDisplay } from './DayCountDisplay';
import { Button } from '@/features/time-off/shared/components/Button';

type RequestModalProps = {
  employeeId: string;
};

function calculateDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// Inner form rendered only when locationId is known — keeps hook calls unconditional.
function RequestForm({
  employeeId,
  locationId,
}: {
  employeeId: string;
  locationId: string;
}) {
  const closeModal = useRequestModalStore((s) => s.closeModal);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // staleTime: 0 — always read fresh balance before a submission (Gap B from audit)
  const { data: balance } = useBalance(employeeId, locationId, {
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { mutate, isPending, isSuccess, reset } = useSubmitRequest();

  const days = calculateDays(startDate, endDate);
  const hasInsufficientBalance = balance !== undefined && days > 0 && days > balance.available;
  const canSubmit = days > 0 && !hasInsufficientBalance && !isPending;

  // Close modal once mutation confirmed (or rolled back — notifications handle that)
  useEffect(() => {
    if (isSuccess) {
      closeModal();
      reset();
    }
  }, [isSuccess, closeModal, reset]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !balance) return;
    mutate({ employeeId, locationId, days, startDate, endDate });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h3 className="text-xs font-semibold tracking-wide" style={{ color: 'var(--ink-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Leave type
        </h3>
        <p className="mt-1 text-base font-semibold" style={{ color: 'var(--ink-1)' }}>
          {balance?.locationName ?? locationId}
        </p>
      </div>

      {balance && (
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-1)' }}>
            {balance.available}
          </span>{' '}
          days available
          {balance.pending > 0 && (
            <>
              {' '}
              ·{' '}
              <span style={{ color: 'var(--status-pending)' }}>
                {balance.pending} pending
              </span>
            </>
          )}
        </p>
      )}

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      <DayCountDisplay days={days} available={balance?.available ?? 0} />

      <div className="flex justify-end gap-3">
        <Button
          onClick={closeModal}
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit}
          variant="primary"
          isLoading={isPending}
        >
          Submit request
        </Button>
      </div>
    </form>
  );
}

export function RequestModal({ employeeId }: RequestModalProps) {
  const { isOpen, locationId } = useRequestModalStore();
  const closeModal = useRequestModalStore((s) => s.closeModal);

  if (!isOpen || !locationId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Request time off"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(24,24,27,0.4)' }}
        onClick={closeModal}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-md p-6"
        style={{
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-1)' }}>
            Request time off
          </h2>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close modal"
            className="focus:outline-none"
            style={{
              color: 'var(--ink-2)',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid transparent',
              background: 'transparent',
            }}
          >
            ×
          </button>
        </div>

        <RequestForm employeeId={employeeId} locationId={locationId} />
      </div>
    </div>
  );
}
