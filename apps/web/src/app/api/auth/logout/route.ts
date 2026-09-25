import { endSession } from '../../../../lib/session-cookie';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  await endSession();
  return Response.json({ ok: true });
}
