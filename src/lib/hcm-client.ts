import type { Balance } from '@/features/time-off/shared/types/balance';
import type { TimeOffRequest } from '@/features/time-off/shared/types/request';
import type { SubmitRequestInput, TriggerAnniversaryInput } from './mock-hcm/logic';

const HCM_REQUEST_TIMEOUT_MS = 8_000;

// ─── Error types ─────────────────────────────────────────────────────────────

export class HCMTimeoutError extends Error {
  constructor(endpoint: string) {
    super(`HCM request timed out after ${HCM_REQUEST_TIMEOUT_MS}ms: ${endpoint}`);
    this.name = 'HCMTimeoutError';
  }
}

export class HCMError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(`HCM ${status}: ${code}`);
    this.name = 'HCMError';
  }
}

// ─── Fetch primitive ──────────────────────────────────────────────────────────

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HCM_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HCMTimeoutError(String(input));
    }
    throw error;
  }
}

async function parseErrorBody(response: Response): Promise<HCMError> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const code = typeof body.error === 'string' ? body.error : 'UNKNOWN_ERROR';
    return new HCMError(response.status, code, body);
  } catch {
    return new HCMError(response.status, 'PARSE_ERROR');
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

function stampFetchedAt(balance: Balance): Balance {
  return { ...balance, fetchedAt: Date.now() };
}

export const hcmClient = {
  // ── Reads ──────────────────────────────────────────────────────────────────

  async getBalance(
    employeeId: string,
    locationId: string,
    simulate?: 'slow' | 'timeout' | 'error',
  ): Promise<Balance> {
    const params = new URLSearchParams({ employeeId, locationId });
    if (simulate) params.set('simulate', simulate);

    const response = await fetchWithTimeout(`/api/mock/hcm/balance?${params}`);
    if (!response.ok) throw await parseErrorBody(response);

    const balance = (await response.json()) as Balance;
    return stampFetchedAt(balance);
  },

  async getBalances(employeeId: string): Promise<Balance[]> {
    const response = await fetchWithTimeout(
      `/api/mock/hcm/balances?employeeId=${employeeId}`,
    );
    if (!response.ok) throw await parseErrorBody(response);

    const balances = (await response.json()) as Balance[];
    return balances.map(stampFetchedAt);
  },

  async getRequestsForEmployee(employeeId: string): Promise<TimeOffRequest[]> {
    const response = await fetchWithTimeout(
      `/api/mock/hcm/requests?employeeId=${employeeId}`,
    );
    if (!response.ok) throw await parseErrorBody(response);
    return response.json() as Promise<TimeOffRequest[]>;
  },

  async getRequestsForManager(managerId: string): Promise<TimeOffRequest[]> {
    const response = await fetchWithTimeout(
      `/api/mock/hcm/requests?managerId=${managerId}`,
    );
    if (!response.ok) throw await parseErrorBody(response);
    return response.json() as Promise<TimeOffRequest[]>;
  },

  // ── Writes ─────────────────────────────────────────────────────────────────

  async submitRequest(
    input: Omit<SubmitRequestInput, 'simulate'>,
    simulate?: 'silent-success' | 'timeout',
  ): Promise<{ requestId: string; status: 'accepted' }> {
    const body = simulate ? { ...input, simulate } : input;

    const response = await fetchWithTimeout('/api/mock/hcm/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await parseErrorBody(response);

    return response.json() as Promise<{ requestId: string; status: 'accepted' }>;
  },

  async approveRequest(
    requestId: string,
  ): Promise<{ requestId: string; status: 'approved' }> {
    const response = await fetchWithTimeout(
      `/api/mock/hcm/requests/${requestId}/approve`,
      { method: 'POST' },
    );
    if (!response.ok) throw await parseErrorBody(response);

    return response.json() as Promise<{ requestId: string; status: 'approved' }>;
  },

  async denyRequest(
    requestId: string,
  ): Promise<{ requestId: string; status: 'denied' }> {
    const response = await fetchWithTimeout(
      `/api/mock/hcm/requests/${requestId}/deny`,
      { method: 'POST' },
    );
    if (!response.ok) throw await parseErrorBody(response);

    return response.json() as Promise<{ requestId: string; status: 'denied' }>;
  },

  async triggerAnniversary(
    input: TriggerAnniversaryInput,
  ): Promise<{ employeeId: string; locationId: string; bonusDays: number; newAvailable: number }> {
    const response = await fetchWithTimeout('/api/mock/hcm/trigger-anniversary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await parseErrorBody(response);

    return response.json() as Promise<{
      employeeId: string;
      locationId: string;
      bonusDays: number;
      newAvailable: number;
    }>;
  },
};
