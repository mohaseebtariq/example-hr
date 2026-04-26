import type { NextRequest } from 'next/server';
import { ensureSeeded, hcmStore } from '@/lib/mock-hcm/store';
import { getBalances } from '@/lib/mock-hcm/logic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const employeeId = searchParams.get('employeeId');

  if (!employeeId) {
    return Response.json({ error: 'MISSING_PARAMS' }, { status: 400 });
  }

  await ensureSeeded();

  // Simulate the real cost of a batch HCM endpoint
  await new Promise((resolve) => setTimeout(resolve, 500));

  const result = getBalances(hcmStore, employeeId);
  return Response.json(result.body, { status: result.status });
}
