import { getServerConfig } from './server-env';

/**
 * Refuses a state-changing request that came from another site.
 *
 * The session cookie is already `SameSite=Lax`, which is what actually stops a cross-site POST from
 * carrying it. This is the second lock: it costs one header comparison and it keeps working if the cookie
 * policy is ever loosened, or on a browser whose SameSite handling turns out to be laxer than advertised.
 *
 * **A missing `Origin` is allowed through, deliberately.** Every browser sends it on a POST, so the attack
 * this defends against always has one; what might not send it is World App's own WebView, and rejecting
 * those would break the Mini App on exactly the devices that cannot be tested here until D2b. A guard that
 * might silently break the product is worse than one with a known, narrow hole — and the hole is narrow
 * because the cookie's SameSite attribute still applies.
 *
 * Two origins are accepted: the configured `APP_ORIGIN`, and the host the request itself arrived on. The
 * second matters on Vercel, where every preview deployment has its own hostname that no environment
 * variable can know in advance; a request whose Origin matches its own Host is same-origin by definition.
 */
export function sameOriginViolation(request: Request): Response | null {
  const origin = request.headers.get('origin');
  if (origin === null) return null;

  const allowed = new Set<string>();
  allowed.add(getServerConfig().appOrigin);
  const host = request.headers.get('host');
  if (host !== null) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  if (allowed.has(origin)) return null;
  // Deliberately terse: the caller learns it was refused, not which origins would have been accepted.
  return Response.json({ error: 'cross-site request refused' }, { status: 403 });
}
