'use client';

type BalanceRefreshedToastProps = {
  type: 'balance-refreshed-up' | 'balance-refreshed-down';
  locationName: string;
  newAvailable: number;
  onDismiss: () => void;
};

export function BalanceRefreshedToast({
  type,
  locationName,
  newAvailable,
  onDismiss,
}: BalanceRefreshedToastProps) {
  const isUp = type === 'balance-refreshed-up';

  const message = isUp
    ? `Your ${locationName} balance was updated to ${newAvailable} days.`
    : `Your ${locationName} balance was reduced to ${newAvailable} days by an external update.`;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-md border p-4 ${
        isUp
          ? 'border-green-200 bg-green-50'
          : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex-1">
        <p className={`text-sm ${isUp ? 'text-green-800' : 'text-amber-800'}`}>
          {message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className={`focus:outline-none ${
          isUp
            ? 'text-green-400 hover:text-green-600'
            : 'text-amber-400 hover:text-amber-600'
        }`}
      >
        ✕
      </button>
    </div>
  );
}
