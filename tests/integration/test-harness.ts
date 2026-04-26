import { vi } from 'vitest';
import { hcmStore } from '@/lib/mock-hcm/store';
import {
  approveRequest,
  denyRequest,
  getBalance,
  getBalances,
  getRequestsForEmployee,
  getRequestsForManager,
  submitRequest,
  triggerAnniversary,
} from '@/lib/mock-hcm/logic';
import type { SubmitRequestInput, TriggerAnniversaryInput } from '@/lib/mock-hcm/logic';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function installMockHcmFetch() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : String(input);
      const url = new URL(rawUrl, 'http://localhost');
      const method = (init?.method ?? 'GET').toUpperCase();

      if (!url.pathname.startsWith('/api/mock/hcm/')) {
        return jsonResponse({ error: 'UNKNOWN_ENDPOINT', url: url.pathname }, 404);
      }

      // Reads
      if (method === 'GET' && url.pathname === '/api/mock/hcm/balance') {
        const employeeId = url.searchParams.get('employeeId') ?? '';
        const locationId = url.searchParams.get('locationId') ?? '';
        const result = getBalance(hcmStore, employeeId, locationId);
        return jsonResponse(result.body, result.status);
      }

      if (method === 'GET' && url.pathname === '/api/mock/hcm/balances') {
        const employeeId = url.searchParams.get('employeeId') ?? '';
        const result = getBalances(hcmStore, employeeId);
        return jsonResponse(result.body, result.status);
      }

      if (method === 'GET' && url.pathname === '/api/mock/hcm/requests') {
        const employeeId = url.searchParams.get('employeeId');
        const managerId = url.searchParams.get('managerId');
        if (employeeId) {
          const result = getRequestsForEmployee(hcmStore, employeeId);
          return jsonResponse(result.body, result.status);
        }
        if (managerId) {
          const result = getRequestsForManager(hcmStore, managerId);
          return jsonResponse(result.body, result.status);
        }
        return jsonResponse({ error: 'MISSING_PARAMS' }, 400);
      }

      // Writes
      if (method === 'POST' && url.pathname === '/api/mock/hcm/requests') {
        const body = JSON.parse(String(init?.body ?? '{}')) as SubmitRequestInput;
        const result = submitRequest(hcmStore, body);
        return jsonResponse(result.body, result.status);
      }

      if (method === 'POST' && url.pathname.endsWith('/approve')) {
        const requestId = url.pathname.split('/').at(-2) ?? '';
        const result = approveRequest(hcmStore, requestId);
        return jsonResponse(result.body, result.status);
      }

      if (method === 'POST' && url.pathname.endsWith('/deny')) {
        const requestId = url.pathname.split('/').at(-2) ?? '';
        const result = denyRequest(hcmStore, requestId);
        return jsonResponse(result.body, result.status);
      }

      if (method === 'POST' && url.pathname === '/api/mock/hcm/trigger-anniversary') {
        const body = JSON.parse(String(init?.body ?? '{}')) as TriggerAnniversaryInput;
        const result = triggerAnniversary(hcmStore, body);
        return jsonResponse(result.body, result.status);
      }

      return jsonResponse({ error: 'UNKNOWN_ENDPOINT', url: url.pathname }, 404);
    });
}

