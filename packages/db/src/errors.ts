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
 *
 * **Two field names, because the two drivers disagree.** PGlite puts it on `constraint`; postgres.js keeps
 * the server's own spelling, `constraint_name`. Reading only the first made duplicate detection work in
 * every local test and fail against a real server, where a resubmitted replay came back as a raw query
 * error instead of a clean "already submitted" — found by the Postgres CI job, which is the only place
 * that difference is visible.
 */
export function pgConstraintName(error: unknown): string | undefined {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    const row = current as { constraint?: unknown; constraint_name?: unknown; cause?: unknown };
    if (typeof row.constraint === 'string') return row.constraint;
    if (typeof row.constraint_name === 'string') return row.constraint_name;
    current = row.cause;
  }
  return undefined;
}
