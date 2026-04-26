import type { NextRequest } from 'next/server';
import { ensureSeeded, hcmStore } from '@/lib/mock-hcm/store';
import { getBalance } from '@/lib/mock-hcm/logic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const employeeId = searchParams.get('employeeId');
  const locationId = searchParams.get('locationId');
  const simulate = searchParams.get('simulate');

  if (!employeeId || !locationId) {
    return Response.json({ error: 'MISSING_PARAMS' }, { status: 400 });
  }

  await ensureSeeded();

  if (simulate === 'slow') {
    await new Promise((resolve) => setTimeout(resolve, 4_000));
  }

  if (simulate === 'timeout') {
    // Never resolves — exercises the 8s client-side timeout
    await new Promise(() => {});
  }

  if (simulate === 'error') {
    return Response.json({ error: 'SERVER_ERROR' }, { status: 503 });
  }

  const result = getBalance(hcmStore, employeeId, locationId);
  return Response.json(result.body, { status: result.status });
}
