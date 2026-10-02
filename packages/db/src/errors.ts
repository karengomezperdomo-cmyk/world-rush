/** PostgreSQL SQLSTATE codes this codebase branches on (https://www.postgresql.org/docs/current/errcodes-appendix.html). */
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_CHECK_VIOLATION = '23514';

/** Walks the `cause` chain (Drizzle wraps driver errors) and returns the PostgreSQL SQLSTATE code, if any. */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Walks the same `cause` chain for the name of the constraint that was violated.
 *
 * The SQLSTATE alone says "something was not unique"; the constraint name says which rule. Matching on the
 * stringified error instead looks like it works and then quietly stops when a driver changes its message
 * format — which is exactly how a duplicate submission turned into a 500 instead of a clean rejection.
 */
export function pgConstraintName(error: unknown): string | undefined {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    const constraint = (current as { constraint?: unknown }).constraint;
    if (typeof constraint === 'string') return constraint;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}
