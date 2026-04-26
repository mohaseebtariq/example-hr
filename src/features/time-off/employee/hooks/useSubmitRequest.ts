'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { hcmClient, HCMError, HCMTimeoutError } from '@/lib/hcm-client';
import { useInFlightMutationsStore, useNotificationsStore } from '@/store';
import type { Balance } from '@/features/time-off/shared/types';

export type SubmitRequestVariables = {
  employeeId: string;
  locationId: string;
  days: number;
  startDate: string;
  endDate: string;
};

type MutationContext = {
  snapshot: Balance | undefined;
  cellKey: string;
};

export function useSubmitRequest() {
  const queryClient = useQueryClient();

  return useMutation<
    { requestId: string; status: 'accepted' },
    Error,
    SubmitRequestVariables,
    MutationContext
  >({
    // ── Phase 1: SNAPSHOT + OPTIMISTIC APPLY ──────────────────────────────
    onMutate: async ({ employeeId, locationId, days }) => {
      const cellKey = `${employeeId}:${locationId}`;

      // Cancel background fetches to prevent race with the optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.balance(employeeId, locationId) });

      const snapshot = queryClient.getQueryData<Balance>(
        queryKeys.balance(employeeId, locationId),
      );

      if (snapshot) {
        queryClient.setQueryData<Balance>(queryKeys.balance(employeeId, locationId), {
          ...snapshot,
          available: snapshot.available - days,
          pending: snapshot.pending + days,
        });
      }

      // Register as in-flight to gate background refreshes (CLAUDE.md §7)
      useInFlightMutationsStore.getState().add(cellKey);

      return { snapshot, cellKey };
    },

    // ── Phase 2: WRITE ────────────────────────────────────────────────────
    mutationFn: (variables) => hcmClient.submitRequest(variables),

    // ── Phase 3a: SUCCESS — canonical re-read ─────────────────────────────
    onSuccess: async (_data, { employeeId, locationId }, context) => {
      const { snapshot } = context;

      try {
        // fetchQuery always calls HCM regardless of active observers, and
        // writes the result into the cache — the only authoritative confirmation.
        const canonical = await queryClient.fetchQuery<Balance>({
          queryKey: queryKeys.balance(employeeId, locationId),
          queryFn: () => hcmClient.getBalance(employeeId, locationId),
          staleTime: 0,
        });

        // Directional check: did the balance go down at all? (Gap A from audit)
        // Using < instead of strict equality so a concurrent anniversary bonus
        // does not cause a false rollback.
        const deductionConfirmed =
          canonical !== undefined &&
          canonical.available < (snapshot?.available ?? Infinity);

        if (!deductionConfirmed) {
          // Silent success — HCM returned 200 but the balance never moved
          if (snapshot) {
            queryClient.setQueryData(queryKeys.balance(employeeId, locationId), snapshot);
          }
          useNotificationsStore.getState().push({
            key: `rollback-silent-${employeeId}-${locationId}-${Date.now()}`,
            type: 'rollback',
            message: 'HCM did not record the deduction. Your balance was unchanged.',
            employeeId,
            locationId,
          });
        }
      } catch {
        // Gap C: canonical re-read itself timed out or errored — treat as rollback
        if (snapshot) {
          queryClient.setQueryData(queryKeys.balance(employeeId, locationId), snapshot);
        }
        useNotificationsStore.getState().push({
          key: `rollback-reread-${employeeId}-${locationId}-${Date.now()}`,
          type: 'rollback',
          message: 'Could not confirm your request. Please check your balance and try again.',
          employeeId,
          locationId,
        });
      }
    },

    // ── Phase 3b: ERROR / ROLLBACK ────────────────────────────────────────
    onError: (error, { employeeId, locationId }, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(
          queryKeys.balance(employeeId, locationId),
          context.snapshot,
        );
      }

      const reason =
        error instanceof HCMTimeoutError
          ? 'Request timed out after 8 seconds. Please try again.'
          : error instanceof HCMError && error.code === 'INSUFFICIENT_BALANCE'
          ? 'Insufficient balance for this request.'
          : error instanceof HCMError && error.code === 'OVERLAPPING_REQUEST'
          ? 'You already have time off in this period for this leave type.'
          : error instanceof HCMError && error.code === 'INVALID_DATE_RANGE'
          ? 'End date must be on or after the start date.'
          : error instanceof HCMError && error.code === 'INVALID_DIMENSION'
          ? 'Invalid leave type for this location.'
          : 'Request could not be submitted. Please try again.';

      useNotificationsStore.getState().push({
        key: `rollback-error-${employeeId}-${locationId}-${Date.now()}`,
        type: 'rollback',
        message: reason,
        employeeId,
        locationId,
      });
    },

    // ── Phase 4: SETTLE (always runs) ─────────────────────────────────────
    onSettled: (_data, _error, { employeeId, locationId }, context) => {
      if (context?.cellKey) {
        useInFlightMutationsStore.getState().remove(context.cellKey);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.balance(employeeId, locationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances(employeeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.employee(employeeId) });
    },
  });
}
