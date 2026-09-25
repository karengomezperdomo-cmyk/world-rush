import {
  users,
  worldIdVerifications,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
  type Db,
} from '@worldrush/db';
import {
  WORLD_ID_ENVIRONMENTS,
  type WorldIdEnvironment,
  type WorldIdProtocolVersion,
} from '@worldrush/shared';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

/**
 * The World ID preset this game uses everywhere (Orb, the strongest credential — decided in
 * docs/phase-0/01-world-docs-review.md §4: "Para este juego: proofOfHuman"). Kept as a named constant so
 * every caller records the same `credential` value instead of each guessing a string.
 */
export const WORLD_ID_CREDENTIAL = 'orb' as const;

/**
 * Calls World's verify endpoint (docs.world.org/api-reference/developer-portal/verify, confirmed
 * 2026-09-24): `POST https://developer.world.org/api/v4/verify/{rp_id}`, forwarding the client's IDKit
 * result unchanged. Only the fields this codebase actually needs are validated strictly (`success`,
 * `nullifier`, `action`, `environment`); everything else in the response (`results[]`, `session_id`,
 * per-credential detail) is NOT parsed here because its exact shape could not be confirmed from the docs
 * alone (docs/phase-0/01-world-docs-review.md §10, items 1-4 — still 🧪/❓, to close once a Developer
 * Portal app exists, decision D1). `protocolVersion` and `credential` are supplied by the CALLER instead of
 * being read off this response, because we already know them: `protocolVersion` is the same field the
 * client's own IDKit result carries (the request we just forwarded), and `credential` is whichever preset
 * we asked for (see WORLD_ID_CREDENTIAL).
 */
// `environment` on a real response can be "production", "staging" OR "sandbox" (confirmed 2026-09-24
// against @worldcoin/idkit-core's own IDKitResultV3/V4 types, which document exactly those three strings).
// Only `production`/`staging` are accepted here on purpose, matching this table's own CHECK constraint
// (packages/db/src/schema.ts, `WORLD_ID_ENVIRONMENTS`): a "sandbox" result means World treated the proof as
// a test/simulator artifact, not a real verification, and a real leaderboard must never record that as a
// human being verified. If a legitimate flow ever needs sandbox (unclear — nothing in `signRequest`'s
// params selects it explicitly), that is a product decision to make deliberately, not something to fall
// into by loosening this schema.
const verifySuccessSchema = z.object({
  success: z.literal(true),
  action: z.string(),
  nullifier: z.string().regex(/^[0-9]+$/, 'nullifier must be a base-10 integer string'),
  environment: z.enum(WORLD_ID_ENVIRONMENTS),
});
const verifyErrorSchema = z.object({
  success: z.literal(false),
  code: z.string(),
  detail: z.string(),
});

export type VerifyApiResult =
  | { ok: true; nullifier: string; action: string; environment: WorldIdEnvironment }
  | { ok: false; code: string; detail: string };

export async function callVerifyEndpoint(
  rpId: string,
  idkitResponse: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifyApiResult> {
  const response = await fetchImpl(
    `https://developer.world.org/api/v4/verify/${encodeURIComponent(rpId)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(idkitResponse),
    },
  );
  const body: unknown = await response.json();

  const success = verifySuccessSchema.safeParse(body);
  if (success.success) {
    return {
      ok: true,
      nullifier: success.data.nullifier,
      action: success.data.action,
      environment: success.data.environment,
    };
  }
  const error = verifyErrorSchema.safeParse(body);
  if (error.success) {
    return { ok: false, code: error.data.code, detail: error.data.detail };
  }
  throw new Error(
    `Unrecognised response from the World ID verify endpoint (HTTP ${response.status}). ` +
      'Its shape may have changed; re-check docs.world.org/api-reference/developer-portal/verify.',
  );
}

export type WorldIdRecordOutcome =
  /** First time this (user, action) pair is recorded. */
  | { status: 'recorded' }
  /** Exact same (user, action, nullifier) as an earlier call: a harmless retry, not an error. */
  | { status: 'already-verified' }
  /** This proof (action, nullifier) already belongs to a DIFFERENT account: reject, do not overwrite. */
  | { status: 'nullifier-claimed-by-another-user' }
  /**
   * This user already verified this action with a DIFFERENT nullifier than the one just presented.
   * Normally shouldn't happen; the known way it could is the legacy/v4 dual-nullifier transition
   * (docs/phase-0/01-world-docs-review.md §10, item 3 — unresolved, ask World before Phase 3).
   */
  | { status: 'user-already-verified-with-different-nullifier' };

/**
 * Records a verified World ID proof, enforcing "one human, one account per action" ourselves — the
 * Developer Portal accepts repeated nullifiers, so this is the only place that guarantee is actually
 * enforced (packages/db/src/schema.ts, `wid_action_nullifier_uq` / `wid_user_action_uq`). On the first
 * successful record for a user, also stamps `users.human_verified_at`.
 */
export async function recordWorldIdVerification(
  db: Db,
  params: {
    userId: string;
    action: string;
    nullifier: string;
    protocolVersion: WorldIdProtocolVersion;
    credential: string;
    environment: WorldIdEnvironment;
  },
): Promise<WorldIdRecordOutcome> {
  try {
    await db.insert(worldIdVerifications).values(params);
  } catch (error) {
    if (pgErrorCode(error) !== PG_UNIQUE_VIOLATION) throw error;

    const [byProof] = await db
      .select({ userId: worldIdVerifications.userId })
      .from(worldIdVerifications)
      .where(
        and(
          eq(worldIdVerifications.action, params.action),
          eq(worldIdVerifications.nullifier, params.nullifier),
        ),
      );
    if (byProof) {
      return byProof.userId === params.userId
        ? { status: 'already-verified' }
        : { status: 'nullifier-claimed-by-another-user' };
    }
    return { status: 'user-already-verified-with-different-nullifier' };
  }

  await db
    .update(users)
    .set({ humanVerifiedAt: sql`now()` })
    .where(eq(users.id, params.userId));
  return { status: 'recorded' };
}
