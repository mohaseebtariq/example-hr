'use client';

import { useEffect } from 'react';
import { useNotificationsStore } from '@/store';
import { BalanceRefreshedToast } from '@/features/time-off/shared/components/BalanceRefreshedToast';
import { ConflictBanner } from '@/features/time-off/shared/components/ConflictBanner';
import { RollbackBanner } from '@/features/time-off/shared/components/RollbackBanner';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const queue = useNotificationsStore((s) => s.queue);
  const dismiss = useNotificationsStore((s) => s.dismiss);

  useEffect(() => {
    if (queue.length === 0) return;
    const head = queue[0];
    const id = window.setTimeout(() => dismiss(head.key), 6_000);
    return () => window.clearTimeout(id);
  }, [queue, dismiss]);

  return (
    <>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="fixed bottom-4 right-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3"
      >
        {queue.map((n) => {
          if (n.type === 'balance-refreshed-up' || n.type === 'balance-refreshed-down') {
            return (
              <BalanceRefreshedToast
                key={n.key}
                type={n.type}
                locationName={n.locationId ?? 'Balance'}
                newAvailable={n.newAvailable ?? 0}
                onDismiss={() => dismiss(n.key)}
              />
            );
          }
          if (n.type === 'rollback') {
            return (
              <RollbackBanner
                key={n.key}
                reason={n.message}
                onDismiss={() => dismiss(n.key)}
              />
            );
          }
          return (
            <ConflictBanner
              key={n.key}
              message={n.message}
              onDismiss={() => dismiss(n.key)}
            />
          );
        })}
      </div>
    </>
  );
}
