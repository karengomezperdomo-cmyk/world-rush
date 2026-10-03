import { sameOriginViolation } from '../../../../lib/same-origin';
import { endSession } from '../../../../lib/session-cookie';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const refused = sameOriginViolation(request);
  if (refused) return refused;

  await endSession();
  return Response.json({ ok: true });
}
