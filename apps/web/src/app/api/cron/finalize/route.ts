import { finalizeDueCompetitions } from '@worldrush/runs';
import { getDb } from '../../../../lib/db';
import { getServerConfig } from '../../../../lib/server-env';

export const dynamic = 'force-dynamic';

/**
 * Freezes every day whose race is over.
 *
 * **Nothing depends on this running.** A finished board is also frozen by the first person to read it
 * (`packages/runs/src/finalize.ts`), which is the design: Vercel's Hobby plan runs cron at most once a day
 * with up to an hour of imprecision, and a leaderboard that stayed live until a job happened to fire would be
 * wrong for an unpredictable stretch of the next day. This endpoint exists so the work is usually done before
 * anyone looks, not so that it gets done at all.
 *
 * Authentication is a shared secret, which Vercel's scheduler sends as `Authorization: Bearer $CRON_SECRET`.
 * With no secret configured the endpoint refuses everyone — including in development. An unauthenticated job
 * endpoint is a free way for a stranger to make the database do work on request, and "it is only
 * finalization" is exactly the reasoning that leaves one open.
 */
export async function GET(request: Request): Promise<Response> {
  const { cronSecret } = getServerConfig();
  if (!cronSecret) {
    return Response.json({ error: 'scheduled jobs are not configured' }, { status: 503 });
  }

  const offered = request.headers.get('authorization');
  if (!timingSafeEquals(offered ?? '', `Bearer ${cronSecret}`)) {
    return Response.json({ error: 'not authorised' }, { status: 401 });
  }

  const db = await getDb();
  const finalized = await finalizeDueCompetitions(db, new Date());
  return Response.json({ finalized });
}

/**
 * Compares two strings without leaking which character differed through how long it took.
 *
 * The length is compared first and does leak, which is fine — the length of a secret is not the secret — and
 * it is what lets the loop below run over a fixed pair of equal-length strings.
 */
function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let index = 0; index < a.length; index += 1) {
    different |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return different === 0;
}
