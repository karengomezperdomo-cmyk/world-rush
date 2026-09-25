import {
  createSession,
  resolveSession,
  revokeSession,
  SESSION_COOKIE_NAME,
  type ResolvedSession,
} from '@worldrush/auth';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { getServerConfig } from './server-env';

/**
 * Next-specific cookie plumbing around the framework-agnostic session logic in `@worldrush/auth`. Only
 * `startSession`/`endSession` (which call `cookies().set/delete`) may run from a Route Handler or Server
 * Action, never from a plain Server Component render (Next.js rule).
 */

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: getServerConfig().appOrigin.startsWith('https://'),
    sameSite: 'lax' as const,
    path: '/',
    expires,
  };
}

export async function startSession(userId: string): Promise<void> {
  const db = await getDb();
  const { token, expiresAt } = await createSession(db, userId);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));
}

/** Safe to call from anywhere (Server Components included): read-only. */
export async function getCurrentSession(): Promise<ResolvedSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const db = await getDb();
  return resolveSession(db, token);
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const db = await getDb();
    await revokeSession(db, token);
  }
  store.delete(SESSION_COOKIE_NAME);
}
