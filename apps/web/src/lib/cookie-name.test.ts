import { SESSION_COOKIE_NAME } from '@worldrush/auth';
import { describe, expect, it } from 'vitest';
import { cookiesAreSecure, sessionCookieName } from './cookie-name';

/**
 * The cookie's name is environment-dependent, which is exactly the kind of thing that gets verified once by
 * hand and then quietly breaks. Production must get the `__Host-` prefix; local development must not, or the
 * browser drops the cookie and nobody can sign in.
 */
describe('the session cookie name', () => {
  it('carries the __Host- prefix on a TLS origin', () => {
    expect(sessionCookieName('https://world-rush.vercel.app')).toBe(
      `__Host-${SESSION_COOKIE_NAME}`,
    );
    expect(cookiesAreSecure('https://world-rush.vercel.app')).toBe(true);
  });

  it('drops the prefix on plain HTTP, which browsers would otherwise refuse to store', () => {
    expect(sessionCookieName('http://localhost:3000')).toBe(SESSION_COOKIE_NAME);
    expect(cookiesAreSecure('http://localhost:3000')).toBe(false);
  });

  it('never treats a lookalike origin as secure', () => {
    // "https" has to be the scheme, not the start of a hostname.
    expect(cookiesAreSecure('http://https.example.com')).toBe(false);
    expect(sessionCookieName('http://https.example.com')).toBe(SESSION_COOKIE_NAME);
  });
});
