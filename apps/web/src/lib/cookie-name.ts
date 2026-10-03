import { SESSION_COOKIE_NAME } from '@worldrush/auth';

/**
 * The session cookie's name, with the `__Host-` prefix wherever the browser will accept it.
 *
 * The prefix is a promise the BROWSER enforces: a cookie named `__Host-…` is only stored when it is Secure,
 * path `/` and carries no `Domain`, and — the part that matters — a page on a sibling subdomain cannot
 * overwrite it. Without it, anything ever hosted at another subdomain of the app's domain can set a session
 * cookie for the app, which is session fixation needing no exploit at all.
 *
 * It is dropped on plain HTTP, because browsers reject such cookies outright and local development is
 * http://localhost. So the name genuinely differs between environments, which is why this is a function with
 * a test rather than a constant.
 */
export function sessionCookieName(appOrigin: string): string {
  return appOrigin.startsWith('https://') ? `__Host-${SESSION_COOKIE_NAME}` : SESSION_COOKIE_NAME;
}

/** Whether cookies may carry the `Secure` attribute, i.e. whether the app is served over TLS. */
export function cookiesAreSecure(appOrigin: string): boolean {
  return appOrigin.startsWith('https://');
}
