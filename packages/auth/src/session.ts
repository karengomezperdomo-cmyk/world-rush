import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, sessions, users, type Db } from '@worldrush/db';
import { type Clock, systemClock } from '@worldrush/shared';

/** Cookie name for the opaque session token. */
export const SESSION_COOKIE_NAME = 'rush7_session';

/** Sliding expiry: a session stays alive while the player keeps coming back. */
export const SESSION_IDLE_TTL_MS = 30 * 24 * 60 * 60_000; // 30 days

/** Hard cap regardless of activity, so a forgotten device cannot stay signed in forever. */
export const SESSION_ABSOLUTE_TTL_MS = 90 * 24 * 60 * 60_000; // 90 days

function hashToken(token: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(token, 'utf8').digest());
}

/** Creates a session and returns the RAW token. Only the SHA-256 hash is ever stored (packages/db/src/schema.ts). */
export async function createSession(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const now = clock.now();
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_TTL_MS);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);
  await db
    .insert(sessions)
    .values({ userId, tokenHash: hashToken(token), expiresAt, absoluteExpiresAt });
  return { token, expiresAt };
}

export interface ResolvedSession {
  userId: string;
  walletAddress: string;
  username: string | null;
  humanVerifiedAt: Date | null;
}

/**
 * Looks up a session by its raw token. Returns null for anything that isn't a live session belonging to an
 * active user: unknown token, revoked, past its sliding or absolute expiry, or a suspended/banned/deleted
 * account (checked here too, not just at login, so acting on a user mid-session takes effect immediately).
 * On success, slides the idle expiry forward (best-effort: a failed update never turns a valid read invalid).
 */
export async function resolveSession(
  db: Db,
  token: string,
  clock: Clock = systemClock,
): Promise<ResolvedSession | null> {
  const tokenHash = hashToken(token);
  const now = clock.now();
  const rows = await db
    .select({
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      absoluteExpiresAt: sessions.absoluteExpiresAt,
      walletAddress: users.walletAddress,
      username: users.username,
      humanVerifiedAt: users.humanVerifiedAt,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.status !== 'active') return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;
  if (row.absoluteExpiresAt.getTime() <= now.getTime()) return null;

  const nextExpiresAt = new Date(
    Math.min(now.getTime() + SESSION_IDLE_TTL_MS, row.absoluteExpiresAt.getTime()),
  );
  await db
    .update(sessions)
    .set({ expiresAt: nextExpiresAt, lastSeenAt: now })
    .where(eq(sessions.tokenHash, tokenHash));

  return {
    userId: row.userId,
    walletAddress: row.walletAddress,
    username: row.username,
    humanVerifiedAt: row.humanVerifiedAt,
  };
}

/** Logout: revokes the session so the same token can never be used again. */
export async function revokeSession(
  db: Db,
  token: string,
  clock: Clock = systemClock,
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: clock.now() })
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)));
}
