import { http, HttpResponse } from 'msw';
import {
  approveRequest,
  denyRequest,
  getBalance,
  getBalances,
  getRequestsForEmployee,
  getRequestsForManager,
  submitRequest,
  adjustBalance,
  triggerAnniversary,
} from '@/lib/mock-hcm/logic';
import type {
  AdjustBalanceInput,
  SubmitRequestInput,
  TriggerAnniversaryInput,
} from '@/lib/mock-hcm/logic';
import { getMswStore } from './msw-store';

export const handlers = [
  http.get('/api/mock/hcm/balance', ({ request }) => {
    const url = new URL(request.url);
    const employeeId = url.searchParams.get('employeeId') ?? '';
    const locationId = url.searchParams.get('locationId') ?? '';
    const result = getBalance(getMswStore(), employeeId, locationId);
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.get('/api/mock/hcm/balances', ({ request }) => {
    const url = new URL(request.url);
    const employeeId = url.searchParams.get('employeeId') ?? '';
    const result = getBalances(getMswStore(), employeeId);
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.get('/api/mock/hcm/requests', ({ request }) => {
    const url = new URL(request.url);
    const employeeId = url.searchParams.get('employeeId');
    const managerId = url.searchParams.get('managerId');

    if (employeeId) {
      const result = getRequestsForEmployee(getMswStore(), employeeId);
      return HttpResponse.json(result.body, { status: result.status });
    }

    if (managerId) {
      const result = getRequestsForManager(getMswStore(), managerId);
      return HttpResponse.json(result.body, { status: result.status });
    }

    return HttpResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
  }),

  http.post('/api/mock/hcm/requests', async ({ request }) => {
    const body = (await request.json()) as SubmitRequestInput;
    const result = submitRequest(getMswStore(), body);
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post('/api/mock/hcm/requests/:id/approve', ({ params }) => {
    const result = approveRequest(getMswStore(), String(params.id));
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post('/api/mock/hcm/requests/:id/deny', ({ params }) => {
    const result = denyRequest(getMswStore(), String(params.id));
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post('/api/mock/hcm/trigger-anniversary', async ({ request }) => {
    const body = (await request.json()) as TriggerAnniversaryInput;
    const result = triggerAnniversary(getMswStore(), body);
    return HttpResponse.json(result.body, { status: result.status });
  }),

  http.post('/api/mock/hcm/adjust-balance', async ({ request }) => {
    if (process.env.ENABLE_DEV_SCENARIOS !== '1') {
      return HttpResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const body = (await request.json()) as AdjustBalanceInput;
    const result = adjustBalance(getMswStore(), body);
    return HttpResponse.json(result.body, { status: result.status });
  }),
];

