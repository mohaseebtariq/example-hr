'use client';

type ConflictBannerProps = {
  message: string;
  onDismiss?: () => void;
};

export function ConflictBanner({ message, onDismiss }: ConflictBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4"
    >
      <div className="flex-1">
        <p className="text-sm text-amber-800">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-amber-400 hover:text-amber-600 focus:outline-none"
        >
          ✕
        </button>
      )}
    </div>
  );
}
