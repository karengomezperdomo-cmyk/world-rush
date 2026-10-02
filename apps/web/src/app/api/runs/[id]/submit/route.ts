import { getPhysicsEngine, MAX_REPLAY_BYTES, SubmissionError, submitRun } from '@worldrush/runs';
import { getDb } from '../../../../../lib/db';
import { getCurrentSession } from '../../../../../lib/session-cookie';

export const dynamic = 'force-dynamic';

/** Which rejections are the caller's fault (400) and which are a timing or state conflict (409). */
const BAD_REQUEST_CODES = new Set(['malformed', 'too_large', 'wrong_map', 'did_not_finish']);

/**
 * Submits a replay and receives the server's verdict.
 *
 * The body is the raw replay bytes, not JSON: it is already a compact binary format and base64 would inflate
 * it by a third for no benefit. The claimed duration rides along in a header, where it is read purely as
 * diagnostics — it is never what gets ranked.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: 'not signed in' }, { status: 401 });

  const { id } = await context.params;

  // Check the advertised length before reading the body, so an oversized upload is refused rather than
  // buffered. The real length is checked again below, because this header is the client's word.
  const advertised = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(advertised) && advertised > MAX_REPLAY_BYTES) {
    return Response.json({ error: 'replay is too large', code: 'too_large' }, { status: 413 });
  }

  const replay = new Uint8Array(await request.arrayBuffer());
  if (replay.byteLength > MAX_REPLAY_BYTES) {
    return Response.json({ error: 'replay is too large', code: 'too_large' }, { status: 413 });
  }

  const claimedHeader = request.headers.get('x-claimed-duration-ms');
  const claimed = claimedHeader === null ? undefined : Number(claimedHeader);
  const claimedDurationMs =
    claimed !== undefined && Number.isInteger(claimed) && claimed > 0 ? claimed : undefined;

  const [db, engine] = await Promise.all([getDb(), getPhysicsEngine()]);
  try {
    const result = await submitRun(db, engine, {
      runId: id,
      userId: session.userId,
      replay,
      claimedDurationMs,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof SubmissionError) {
      const status = error.code === 'not_found' ? 404 : BAD_REQUEST_CODES.has(error.code) ? 400 : 409;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
