import {
  callVerifyEndpoint,
  recordWorldIdVerification,
  WORLD_ID_CREDENTIAL,
} from '@worldrush/auth';
import { WORLD_ID_PROTOCOL_VERSIONS } from '@worldrush/shared';
import { z } from 'zod';
import { getDb } from '../../../../lib/db';
import { getCurrentSession } from '../../../../lib/session-cookie';
import { getWorldIdConfig, WorldIdNotConfiguredError } from '../../../../lib/world-config';

export const dynamic = 'force-dynamic';

// The client forwards IDKit's `handleVerify(result)` payload unmodified; we only need to read `action` and
// `protocol_version` out of it (both are already present in that object — see docs/phase-0/01-world-docs-
// review.md §4 and the confirmed v4 verify-endpoint request shape). Everything else is passed through as-is.
const requestSchema = z
  .object({ action: z.string().min(1), protocol_version: z.enum(WORLD_ID_PROTOCOL_VERSIONS) })
  .passthrough();

export async function POST(request: Request): Promise<Response> {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: 'sign in first' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'malformed IDKit response' }, { status: 400 });

  let rpId: string;
  try {
    ({ rpId } = getWorldIdConfig());
  } catch (error) {
    if (error instanceof WorldIdNotConfiguredError)
      return Response.json({ error: error.message }, { status: 503 });
    throw error;
  }

  // NOTE (honesty about a real gap): `signal` binding is NOT independently re-checked here. The client
  // embeds `signal: <our own session's user id>` into the proof via `proofOfHuman({ signal })` — that is
  // the correct, required usage — but whether/how the verify endpoint itself enforces that signal server
  // side is unconfirmed: the verify request/response fields found in docs.world.org/api-reference/
  // developer-portal/verify do not show a signal/signal_hash field to check (docs/phase-0/01-world-docs-
  // review.md §10, item 2 — unresolved; ask World or confirm empirically in Phase 3 with a real device and
  // Developer Portal app, decisions D1/D2). The nullifier-uniqueness check below is unaffected by this gap:
  // it is what actually stops one human from registering twice, and it IS enforced here, by us.
  const result = await callVerifyEndpoint(rpId, parsed.data);
  if (!result.ok) {
    return Response.json({ error: result.detail, code: result.code }, { status: 400 });
  }

  const db = await getDb();
  const outcome = await recordWorldIdVerification(db, {
    userId: session.userId,
    action: result.action,
    nullifier: result.nullifier,
    protocolVersion: parsed.data.protocol_version,
    credential: WORLD_ID_CREDENTIAL,
    environment: result.environment,
  });

  if (outcome.status === 'nullifier-claimed-by-another-user') {
    return Response.json(
      { error: 'this World ID is already linked to a different account' },
      { status: 409 },
    );
  }
  if (outcome.status === 'user-already-verified-with-different-nullifier') {
    return Response.json(
      { error: 'this account already verified this action with a different proof' },
      { status: 409 },
    );
  }
  return Response.json({ status: outcome.status, humanVerified: true });
}
