import { issueNonce } from '@worldrush/auth';
import { getDb } from '../../../../lib/db';
import { sameOriginViolation } from '../../../../lib/same-origin';

// Always issues a fresh, single-use nonce: never cached.
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const refused = sameOriginViolation(request);
  if (refused) return refused;

  const db = await getDb();
  const { nonce } = await issueNonce(db);
  return Response.json({ nonce }, { headers: { 'Cache-Control': 'no-store' } });
}
