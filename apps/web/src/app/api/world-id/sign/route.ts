import { signWorldIdRequest } from '@worldrush/auth';
import { z } from 'zod';
import { getCurrentSession } from '../../../../lib/session-cookie';
import { getWorldIdConfig, WorldIdNotConfiguredError } from '../../../../lib/world-config';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ action: z.string().min(1).max(200) });

/** Step 3 of the IDKit flow: sign an RP context for the client's `<IDKitRequestWidget rp_context={...}>`. */
export async function POST(request: Request): Promise<Response> {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: 'sign in first' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'invalid action' }, { status: 400 });

  try {
    const { rpId, rpSigningKey } = getWorldIdConfig();
    const rpContext = signWorldIdRequest(rpId, rpSigningKey, parsed.data.action);
    return Response.json(rpContext, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof WorldIdNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
