import { ensureSeeded, hcmStore } from '@/lib/mock-hcm/store';
import { triggerAnniversary } from '@/lib/mock-hcm/logic';
import type { TriggerAnniversaryInput } from '@/lib/mock-hcm/logic';

export async function POST(req: Request) {
  const body = (await req.json()) as TriggerAnniversaryInput;

  if (!body.employeeId || !body.locationId || typeof body.bonusDays !== 'number') {
    return Response.json({ error: 'MISSING_PARAMS' }, { status: 400 });
  }

  await ensureSeeded();

  const result = triggerAnniversary(hcmStore, body);
  return Response.json(result.body, { status: result.status });
}
