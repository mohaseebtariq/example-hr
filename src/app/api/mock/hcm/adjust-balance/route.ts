import { ensureSeeded, hcmStore } from '@/lib/mock-hcm/store';
import { adjustBalance } from '@/lib/mock-hcm/logic';
import type { AdjustBalanceInput } from '@/lib/mock-hcm/logic';

export async function POST(req: Request) {
  // Dev-only: do not expose scenario tools unless explicitly enabled.
  if (process.env.ENABLE_DEV_SCENARIOS !== '1') {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const body = (await req.json()) as AdjustBalanceInput;

  if (!body.employeeId || !body.locationId) {
    return Response.json({ error: 'MISSING_PARAMS' }, { status: 400 });
  }

  await ensureSeeded();

  const result = adjustBalance(hcmStore, body);
  return Response.json(result.body, { status: result.status });
}

