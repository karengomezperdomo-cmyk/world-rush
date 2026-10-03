import { startRun, SubmissionError } from '@worldrush/runs';
import { getDb } from '../../../../lib/db';
import { getCurrentSession } from '../../../../lib/session-cookie';
import { sameOriginViolation } from '../../../../lib/same-origin';

export const dynamic = 'force-dynamic';

/**
 * Opens a run against today's competition.
 *
 * The server stamps the start time from its own clock and returns an id the client must quote when it
 * submits. A client-chosen start time would let anyone submit yesterday's race tomorrow, and a client-chosen
 * run id would let them submit against someone else's.
 */
export async function POST(request: Request): Promise<Response> {
  const refused = sameOriginViolation(request);
  if (refused) return refused;

  const session = await getCurrentSession();
  if (!session) return Response.json({ error: 'not signed in' }, { status: 401 });

  const db = await getDb();
  try {
    const run = await startRun(db, session.userId);
    return Response.json({
      runId: run.runId,
      mapSlug: run.mapSlug,
      mapNumber: run.mapNumber,
      ruleset: run.ruleset,
    });
  } catch (error) {
    if (error instanceof SubmissionError) {
      return Response.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
  }
}
