import type { AppEnv } from '@worldrush/shared';

/**
 * Names that must never appear in a NEXT_PUBLIC_* variable: those are inlined into the browser bundle.
 * (scripts/check-public-env.mjs keeps an identical copy for the repository scan; a test keeps them in sync.)
 */
export const SECRET_LIKE_NAME =
  /(SECRET|PRIVATE|SIGNING|API_?KEY|PASSWORD|PASSWD|TOKEN|DATABASE|CREDENTIAL|HMAC)/i;

export function findSecretLikePublicKeys(
  source: Readonly<Record<string, string | undefined>>,
): string[] {
  return Object.keys(source)
    .filter((key) => key.startsWith('NEXT_PUBLIC_') && SECRET_LIKE_NAME.test(key))
    .map(
      (key) =>
        `${key}: NEXT_PUBLIC_* variables are shipped to the browser, so secret-like names are not allowed`,
    );
}

/** True for embedded/local databases, which are only acceptable in development. */
export function isLocalDatabaseUrl(url: string): boolean {
  return (
    /^(pglite|file|memory):/i.test(url) ||
    /(^|[@/])(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url)
  );
}

/** Guards development-only code paths (e.g. the fake-login harness) so they can never run elsewhere. */
export function assertDevelopmentOnly(appEnv: AppEnv, what: string): void {
  if (appEnv !== 'development') {
    throw new Error(`${what} is only available when APP_ENV=development (got APP_ENV=${appEnv})`);
  }
}
