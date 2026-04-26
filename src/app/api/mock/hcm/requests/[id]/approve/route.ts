import { ensureSeeded, hcmStore } from '@/lib/mock-hcm/store';
import { approveRequest } from '@/lib/mock-hcm/logic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await ensureSeeded();
  const result = approveRequest(hcmStore, id);
  return Response.json(result.body, { status: result.status });
}
