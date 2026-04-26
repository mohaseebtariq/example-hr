'use client';

const DEFAULT_MESSAGE = 'Your request could not be confirmed. Please try again.';

type RollbackBannerProps = {
  reason?: string;
  onDismiss?: () => void;
};

export function RollbackBanner({ reason, onDismiss }: RollbackBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4"
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">Request rolled back</p>
        <p className="mt-1 text-sm text-red-700">{reason ?? DEFAULT_MESSAGE}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss rollback notice"
          className="text-red-400 hover:text-red-600 focus:outline-none"
        >
          ✕
        </button>
      )}
    </div>
  );
}
