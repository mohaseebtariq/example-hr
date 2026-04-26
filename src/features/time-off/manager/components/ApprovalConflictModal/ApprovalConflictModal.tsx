'use client';

import { Button } from '@/features/time-off/shared/components/Button';

type ApprovalConflictModalProps = {
  isOpen: boolean;
  currentBalance: number;
  onClose: () => void;
};

export function ApprovalConflictModal({
  isOpen,
  currentBalance,
  onClose,
}: ApprovalConflictModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Approval conflict"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(27, 43, 75, 0.35)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-md border p-6"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--ink-1)' }}>
            Balance changed since request
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-2)' }}>
            The balance is now <span className="font-semibold">{currentBalance}</span>{' '}
            days. Refresh the list and review before making a decision.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose} variant="primary">
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}

