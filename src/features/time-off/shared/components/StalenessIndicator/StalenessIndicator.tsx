'use client';

import { useEffect, useMemo, useState } from 'react';

export const VISIBLE_STALENESS_THRESHOLD_MS = 60_000;

type StalenessIndicatorProps = {
  fetchedAt: number;
  onRefresh?: () => void;
};

export function StalenessIndicator({ fetchedAt, onRefresh }: StalenessIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Update occasionally so the stale indicator can appear over time.
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const msSinceLastFetch = useMemo(() => now - fetchedAt, [now, fetchedAt]);
  const isVisiblyStale = msSinceLastFetch > VISIBLE_STALENESS_THRESHOLD_MS;

  if (!isVisiblyStale) return null;

  const minutesAgo = Math.floor(msSinceLastFetch / 60_000);
  const ageLabel = minutesAgo === 1 ? '1 min ago' : `${minutesAgo} min ago`;

  return (
    <div className="flex items-center gap-2 text-xs text-amber-600">
      <span>Balance as of {ageLabel}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="underline hover:no-underline focus:outline-none"
          aria-label="Refresh balance"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
