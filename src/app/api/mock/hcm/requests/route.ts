import type { NextRequest } from 'next/server';
import { ensureSeeded, hcmStore } from '@/lib/mock-hcm/store';
import {
  getRequestsForEmployee,
  getRequestsForManager,
  submitRequest,
} from '@/lib/mock-hcm/logic';
import type { SubmitRequestInput } from '@/lib/mock-hcm/logic';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const { searchParams } = req.nextUrl;
  const employeeId = searchParams.get('employeeId');
  const managerId = searchParams.get('managerId');

  if (employeeId) {
    const result = getRequestsForEmployee(hcmStore, employeeId);
    return Response.json(result.body, { status: result.status });
  }

  if (managerId) {
    const result = getRequestsForManager(hcmStore, managerId);
    return Response.json(result.body, { status: result.status });
  }

  return Response.json({ error: 'MISSING_PARAMS' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const body = (await req.json()) as SubmitRequestInput;

  if (!body.employeeId || !body.locationId || !body.days || !body.startDate || !body.endDate) {
    return Response.json({ error: 'MISSING_PARAMS' }, { status: 400 });
  }

  if (body.simulate === 'silent-success') {
    const result = submitRequest(hcmStore, { ...body, simulate: 'silent-success' });
    return Response.json(result.body, { status: result.status });
  }

  const result = submitRequest(hcmStore, body);
  return Response.json(result.body, { status: result.status });
}
