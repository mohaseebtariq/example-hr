'use client';

type DayCountDisplayProps = {
  days: number;
  available: number;
};

export function DayCountDisplay({ days, available }: DayCountDisplayProps) {
  const hasInsufficientBalance = days > 0 && days > available;

  if (days === 0) {
    return (
      <p className="text-sm text-gray-500">Select a date range to see the day count.</p>
    );
  }

  return (
    <div className="rounded-md border p-3">
      <p className={`text-sm font-medium ${hasInsufficientBalance ? 'text-red-700' : 'text-gray-900'}`}>
        {days} day{days !== 1 ? 's' : ''} requested
      </p>
      {hasInsufficientBalance && (
        <p className="mt-1 text-sm text-red-600">
          Insufficient balance — you have {available} day{available !== 1 ? 's' : ''} available.
        </p>
      )}
    </div>
  );
}
