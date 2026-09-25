import { users, type Db } from '@worldrush/db';
import { sql } from 'drizzle-orm';

export interface AuthenticatedUser {
  id: string;
  walletAddress: string;
  username: string | null;
  humanVerifiedAt: Date | null;
}

/**
 * Finds or creates the user for a verified wallet address and stamps `last_login_at`. Identity only: a
 * suspended/banned/deleted account can still complete this (SIWE just proves wallet ownership), but
 * `resolveSession` refuses to treat the resulting session as usable for anything but an inactive user.
 */
export async function upsertUserByWallet(
  db: Db,
  walletAddress: string,
): Promise<AuthenticatedUser> {
  const lower = walletAddress.toLowerCase();
  const [row] = await db
    .insert(users)
    .values({ walletAddress: lower, lastLoginAt: sql`now()` })
    .onConflictDoUpdate({ target: users.walletAddress, set: { lastLoginAt: sql`now()` } })
    .returning({
      id: users.id,
      walletAddress: users.walletAddress,
      username: users.username,
      humanVerifiedAt: users.humanVerifiedAt,
    });
  if (!row) throw new Error('user upsert returned no row');
  return row;
}
