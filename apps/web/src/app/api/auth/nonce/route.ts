import { issueNonce } from '@worldrush/auth';
import { getDb } from '../../../../lib/db';

// Always issues a fresh, single-use nonce: never cached.
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  const db = await getDb();
  const { nonce } = await issueNonce(db);
  return Response.json({ nonce }, { headers: { 'Cache-Control': 'no-store' } });
}
