import {
  createSession,
  resolveSession,
  revokeSession,
  SESSION_COOKIE_NAME,
  type ResolvedSession,
} from '@worldrush/auth';
import { cookies } from 'next/headers';
import { cookiesAreSecure, sessionCookieName } from './cookie-name';
import { getDb } from './db';
import { getServerConfig } from './server-env';

/**
 * Next-specific cookie plumbing around the framework-agnostic session logic in `@worldrush/auth`. Only
 * `startSession`/`endSession` (which call `cookies().set/delete`) may run from a Route Handler or Server
 * Action, never from a plain Server Component render (Next.js rule).
 */

/** Both rules live in `cookie-name.ts`, where they are unit-tested: they differ per environment. */
function cookieName(): string {
  return sessionCookieName(getServerConfig().appOrigin);
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: cookiesAreSecure(getServerConfig().appOrigin),
    // Lax, not Strict: the session must survive the player following a link into the Mini App, which is how
    // World App opens it. Lax still refuses to send the cookie on a cross-site POST, which is the CSRF case.
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}

export async function startSession(userId: string): Promise<void> {
  const db = await getDb();
  const { token, expiresAt } = await createSession(db, userId);
  const store = await cookies();
  store.set(cookieName(), token, cookieOptions(expiresAt));
  // A session issued under the prefixed name makes the old unprefixed one dead weight that would still be
  // sent on every request. Clearing it keeps exactly one session cookie in flight.
  if (cookieName() !== SESSION_COOKIE_NAME) store.delete(SESSION_COOKIE_NAME);
}

/**
 * Safe to call from anywhere (Server Components included): read-only.
 *
 * Both names are read, newest first. The prefix was added after sessions already existed, and reading only
 * the new name would have signed out everyone who was logged in at the moment it deployed — a real cost for
 * no security gain, since the token itself is what authenticates and it is unchanged.
 */
export async function getCurrentSession(): Promise<ResolvedSession | null> {
  const store = await cookies();
  const token = store.get(cookieName())?.value ?? store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const db = await getDb();
  return resolveSession(db, token);
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(cookieName())?.value ?? store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const db = await getDb();
    await revokeSession(db, token);
  }
  // Both, so signing out cannot leave a stale cookie behind under the other name.
  store.delete(cookieName());
  store.delete(SESSION_COOKIE_NAME);
}
