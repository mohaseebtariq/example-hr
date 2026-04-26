/**
 * Mock HCM business logic — pure functions, zero Next.js imports.
 *
 * Route handlers are thin wrappers around these. Integration tests import
 * these directly (no network, no Next.js runtime required).
 *
 * fetchedAt is NOT set here on reads — hcm-client.ts stamps it when the
 * HTTP response arrives at the client. fetchedAt IS updated here on writes
 * (deductions, bonuses, restores) to record when HCM last mutated the value.
 */

import type { Balance } from '@/features/time-off/shared/types/balance';
import type { TimeOffRequest } from '@/features/time-off/shared/types/request';
import type { HcmStore } from './store';
import { balanceKey } from './store';

// 20% of POST /requests calls return 200 without committing the write.
// This is the primary regression target for canonical re-read logic.
const SILENT_SUCCESS_PROBABILITY = 0.2;

export type LogicResult<T = Record<string, unknown>> = {
  status: number;
  body: T;
};

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

function parseYmd(value: string): number {
  const [y, m, d] = value.split('-').map((part) => Number(part));
  return Date.UTC(y, m - 1, d);
}

function rangesOverlapInclusive(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a0 = parseYmd(aStart);
  const a1 = parseYmd(aEnd);
  const b0 = parseYmd(bStart);
  const b1 = parseYmd(bEnd);
  return a0 <= b1 && b0 <= a1;
}

function hasOverlappingCommittedRequest(
  store: HcmStore,
  employeeId: string,
  startDate: string,
  endDate: string,
): boolean {
  for (const existing of store.requests.values()) {
    if (existing.employeeId !== employeeId) continue;
    if (existing.status === 'denied' || existing.status === 'rolled-back') continue;

    if (rangesOverlapInclusive(startDate, endDate, existing.startDate, existing.endDate)) {
      return true;
    }
  }

  return false;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export function getBalance(
  store: HcmStore,
  employeeId: string,
  locationId: string,
): LogicResult {
  const balance = store.balances.get(balanceKey(employeeId, locationId));
  if (!balance) {
    return { status: 404, body: { error: 'NOT_FOUND' } };
  }
  // Return as-is — hcm-client.ts overwrites fetchedAt with Date.now()
  return { status: 200, body: balance };
}

export function getBalances(
  store: HcmStore,
  employeeId: string,
): LogicResult<Balance[]> {
  const results: Balance[] = [];
  for (const balance of store.balances.values()) {
    if (balance.employeeId === employeeId) {
      results.push(balance);
    }
  }
  return { status: 200, body: results };
}

export function getRequestsForEmployee(
  store: HcmStore,
  employeeId: string,
): LogicResult<TimeOffRequest[]> {
  const results = Array.from(store.requests.values()).filter(
    (r) => r.employeeId === employeeId,
  );
  return { status: 200, body: results };
}

export function getRequestsForManager(
  store: HcmStore,
  managerId: string,
): LogicResult<TimeOffRequest[]> {
  const managedEmployeeIds = new Set(
    Array.from(store.employees.values())
      .filter((e) => e.managerId === managerId)
      .map((e) => e.id),
  );

  const pendingRequests = Array.from(store.requests.values()).filter(
    (r) => managedEmployeeIds.has(r.employeeId) && r.status === 'pending-manager',
  );

  return { status: 200, body: pendingRequests };
}

export function getRequest(
  store: HcmStore,
  requestId: string,
): LogicResult {
  const request = store.requests.get(requestId);
  if (!request) {
    return { status: 404, body: { error: 'NOT_FOUND' } };
  }
  return { status: 200, body: request };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export type SubmitRequestInput = {
  employeeId: string;
  locationId: string;
  days: number;
  startDate: string;
  endDate: string;
  // Force silent-success path for deterministic tests. Omit for random 20% behavior.
  simulate?: 'silent-success';
};

export function submitRequest(
  store: HcmStore,
  input: SubmitRequestInput,
): LogicResult {
  const { employeeId, locationId, days, startDate, endDate, simulate } = input;

  const balance = store.balances.get(balanceKey(employeeId, locationId));
  if (!balance) {
    return { status: 400, body: { error: 'INVALID_DIMENSION' } };
  }

  if (parseYmd(endDate) < parseYmd(startDate)) {
    return { status: 400, body: { error: 'INVALID_DATE_RANGE' } };
  }

  if (hasOverlappingCommittedRequest(store, employeeId, startDate, endDate)) {
    return {
      status: 409,
      body: { error: 'OVERLAPPING_REQUEST', startDate, endDate, locationId },
    };
  }

  if (balance.available < days) {
    return { status: 409, body: { error: 'INSUFFICIENT_BALANCE', available: balance.available } };
  }

  const requestId = generateRequestId();

  const isSilentSuccess =
    simulate === 'silent-success' || Math.random() < SILENT_SUCCESS_PROBABILITY;

  if (isSilentSuccess) {
    // HCM lies: returns 200 but does NOT deduct the balance and does NOT store
    // the request. The canonical re-read in useSubmitRequest detects this because
    // the balance will NOT have moved.
    return { status: 200, body: { requestId, status: 'accepted' } };
  }

  // Commit the write
  const request: TimeOffRequest = {
    id: requestId,
    employeeId,
    locationId,
    days,
    startDate,
    endDate,
    status: 'pending-manager',
  };
  store.requests.set(requestId, request);

  store.balances.set(balanceKey(employeeId, locationId), {
    ...balance,
    available: balance.available - days,
    pending: balance.pending + days,
    // fetchedAt updated here because HCM just mutated the value
    fetchedAt: Date.now(),
  });

  return { status: 200, body: { requestId, status: 'accepted' } };
}

export function approveRequest(
  store: HcmStore,
  requestId: string,
): LogicResult {
  const request = store.requests.get(requestId);
  if (!request) {
    return { status: 404, body: { error: 'NOT_FOUND' } };
  }

  if (request.status !== 'pending-manager') {
    return { status: 400, body: { error: 'INVALID_STATE', currentStatus: request.status } };
  }

  const balance = store.balances.get(balanceKey(request.employeeId, request.locationId));

  // Balance is reserved at submit time by moving days into `pending`.
  // If the reservation is missing (e.g. external reset), surface BALANCE_CHANGED.
  const currentBalance = balance?.available ?? 0;
  const currentPending = balance?.pending ?? 0;
  if (!balance || currentPending < request.days) {
    return {
      status: 409,
      body: { error: 'BALANCE_CHANGED', currentBalance },
    };
  }

  store.requests.set(requestId, { ...request, status: 'approved' });
  store.balances.set(balanceKey(request.employeeId, request.locationId), {
    ...balance,
    pending: balance.pending - request.days,
    fetchedAt: Date.now(),
  });

  return { status: 200, body: { requestId, status: 'approved' } };
}

export function denyRequest(
  store: HcmStore,
  requestId: string,
): LogicResult {
  const request = store.requests.get(requestId);
  if (!request) {
    return { status: 404, body: { error: 'NOT_FOUND' } };
  }

  if (request.status !== 'pending-manager') {
    return { status: 400, body: { error: 'INVALID_STATE', currentStatus: request.status } };
  }

  store.requests.set(requestId, { ...request, status: 'denied' });

  // Restore the deducted balance
  const balance = store.balances.get(balanceKey(request.employeeId, request.locationId));
  if (balance) {
    store.balances.set(balanceKey(request.employeeId, request.locationId), {
      ...balance,
      available: balance.available + request.days,
      pending: Math.max(0, balance.pending - request.days),
      fetchedAt: Date.now(),
    });
  }

  return { status: 200, body: { requestId, status: 'denied' } };
}

export type TriggerAnniversaryInput = {
  employeeId: string;
  locationId: string;
  bonusDays: number;
};

export type AdjustBalanceInput = {
  employeeId: string;
  locationId: string;
  availableDelta?: number;
  pendingDelta?: number;
};

export function triggerAnniversary(
  store: HcmStore,
  input: TriggerAnniversaryInput,
): LogicResult {
  const { employeeId, locationId, bonusDays } = input;

  const balance = store.balances.get(balanceKey(employeeId, locationId));
  if (!balance) {
    return { status: 404, body: { error: 'NOT_FOUND' } };
  }

  const updatedBalance: Balance = {
    ...balance,
    available: balance.available + bonusDays,
    fetchedAt: Date.now(),
  };
  store.balances.set(balanceKey(employeeId, locationId), updatedBalance);

  return {
    status: 200,
    body: { employeeId, locationId, bonusDays, newAvailable: updatedBalance.available },
  };
}

export function adjustBalance(store: HcmStore, input: AdjustBalanceInput): LogicResult {
  const { employeeId, locationId } = input;
  const availableDelta = input.availableDelta ?? 0;
  const pendingDelta = input.pendingDelta ?? 0;

  const balance = store.balances.get(balanceKey(employeeId, locationId));
  if (!balance) {
    return { status: 404, body: { error: 'NOT_FOUND' } };
  }

  const updatedBalance: Balance = {
    ...balance,
    available: Math.max(0, balance.available + availableDelta),
    pending: Math.max(0, balance.pending + pendingDelta),
    fetchedAt: Date.now(),
  };
  store.balances.set(balanceKey(employeeId, locationId), updatedBalance);

  return {
    status: 200,
    body: {
      employeeId,
      locationId,
      availableDelta,
      pendingDelta,
      newAvailable: updatedBalance.available,
      newPending: updatedBalance.pending,
    },
  };
}
