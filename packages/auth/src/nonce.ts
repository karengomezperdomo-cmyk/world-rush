import { randomBytes } from 'node:crypto';
import { authNonces, type Db } from '@worldrush/db';
import { type Clock, systemClock } from '@worldrush/shared';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';

/**
 * How long a freshly issued nonce stays valid. Generous enough to cover opening the World App signing
 * sheet and confirming; short enough that an abandoned nonce cannot be replayed much later.
 */
export const NONCE_TTL_MS = 10 * 60_000;

/**
 * Random nonce for `walletAuth`. MiniKit requires alphanumeric, at least 8 characters, no hyphens
 * (docs/phase-0/01-world-docs-review.md §2.5); 48 lowercase-hex characters also satisfies the database's
 * `^[A-Za-z0-9]{16,64}$` check (packages/db/src/schema.ts).
 */
function randomNonce(): string {
  return randomBytes(24).toString('hex');
}

/** Issues and stores a single-use SIWE nonce. */
export async function issueNonce(
  db: Db,
  clock: Clock = systemClock,
): Promise<{ nonce: string; expiresAt: Date }> {
  const nonce = randomNonce();
  const expiresAt = new Date(clock.now().getTime() + NONCE_TTL_MS);
  await db.insert(authNonces).values({ nonce, expiresAt });
  return { nonce, expiresAt };
}

/**
 * Consumes a nonce exactly once. The UPDATE only matches a row that is unexpired and not yet consumed, so
 * two concurrent completions of the same wallet-auth attempt can never both succeed: the loser gets 0 rows,
 * which the caller must treat as "reject this completion" (see verifyWalletAuthCompletion).
 */
export async function consumeNonce(
  db: Db,
  nonce: string,
  clock: Clock = systemClock,
): Promise<boolean> {
  const rows = await db
    .update(authNonces)
    .set({ consumedAt: sql`now()` })
    .where(
      and(
        eq(authNonces.nonce, nonce),
        isNull(authNonces.consumedAt),
        gt(authNonces.expiresAt, clock.now()),
      ),
    )
    .returning({ nonce: authNonces.nonce });
  return rows.length === 1;
}
