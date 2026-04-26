'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { hcmClient } from '@/lib/hcm-client';
import { useInFlightMutationsStore, useNotificationsStore } from '@/store';
import type { Balance } from '@/features/time-off/shared/types';

type UseBalanceOptions = {
  staleTime?: number;
  refetchOnMount?: boolean | 'always';
};

export function useBalance(
  employeeId: string,
  locationId: string,
  options?: UseBalanceOptions,
) {
  const queryClient = useQueryClient();
  const previousDataRef = useRef<Balance | undefined>(undefined);
  const hasSeenFirstFetchAfterMountRef = useRef(false);

  const result = useQuery({
    queryKey: queryKeys.balance(employeeId, locationId),
    queryFn: async () => {
      const cellKey = `${employeeId}:${locationId}`;

      // Background refresh race condition guard (CLAUDE.md §7):
      // If a mutation is in-flight for this cell, return the current cached value
      // so the background poll cannot overwrite the optimistic state.
      if (useInFlightMutationsStore.getState().has(cellKey)) {
        const cached = queryClient.getQueryData<Balance>(
          queryKeys.balance(employeeId, locationId),
        );
        if (cached) return cached;
      }

      return hcmClient.getBalance(employeeId, locationId);
    },
    staleTime: options?.staleTime ?? 10_000,
    refetchOnMount: options?.refetchOnMount ?? true,
  });

  // Out-of-band balance change detection:
  // If balance changed without a user-initiated mutation (anniversary bonus,
  // external write), dispatch a toast notification.
  useEffect(() => {
    if (!result.data) return;

    // Noise guard: do not show “balance updated” toasts on initial load/mount.
    // We only start notifying after the first successful fetch after mount,
    // so background refetches (interval/focus) remain visible.
    if (!hasSeenFirstFetchAfterMountRef.current && result.isFetchedAfterMount) {
      hasSeenFirstFetchAfterMountRef.current = true;
      previousDataRef.current = result.data;
      return;
    }

    const prev = previousDataRef.current;
    previousDataRef.current = result.data;

    if (!prev) return;
    if (prev.available === result.data.available) return;
    if (result.data.fetchedAt <= prev.fetchedAt) return;

    const cellKey = `${employeeId}:${locationId}`;
    if (useInFlightMutationsStore.getState().has(cellKey)) return;

    const delta = result.data.available - prev.available;
    const type = delta > 0 ? 'balance-refreshed-up' : 'balance-refreshed-down';

    useNotificationsStore.getState().push({
      key: `${type}-${employeeId}-${locationId}-${result.data.fetchedAt}`,
      type,
      message:
        delta > 0
          ? `Your ${result.data.locationName} balance was updated to ${result.data.available} days.`
          : `Your ${result.data.locationName} balance was reduced to ${result.data.available} days by an external update.`,
      employeeId,
      locationId,
      newAvailable: result.data.available,
    });
  }, [result.data, result.isFetchedAfterMount, employeeId, locationId]);

  return result;
}
