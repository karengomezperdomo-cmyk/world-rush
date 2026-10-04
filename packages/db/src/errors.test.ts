import { describe, expect, it } from 'vitest';
import { PG_UNIQUE_VIOLATION, pgConstraintName, pgErrorCode } from './errors';

/**
 * Reading a PostgreSQL error, whichever driver produced it.
 *
 * These two helpers decide whether a duplicate submission is answered with "already submitted" or with a
 * 500, so the shapes they have to cope with are pinned here rather than discovered in production. The
 * shapes below are the real ones: PGlite names the field `constraint`, postgres.js keeps the server's own
 * `constraint_name`, and Drizzle wraps either in a `DrizzleQueryError` with the driver error as `cause`.
 *
 * Reading only PGlite's spelling is a bug this project actually shipped: every local test passed and every
 * resubmitted replay against the hosted database came back as a raw query error.
 */

/** What PGlite throws, wrapped by Drizzle. */
function pgliteError(): unknown {
  return Object.assign(new Error('Failed query: insert into "runs" ...'), {
    cause: Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: PG_UNIQUE_VIOLATION,
      constraint: 'runs_replay_hash_uidx',
    }),
  });
}

/** What postgres.js throws, wrapped by Drizzle. */
function postgresJsError(): unknown {
  return Object.assign(new Error('Failed query: insert into "runs" ...'), {
    cause: Object.assign(new Error('duplicate key value violates unique constraint'), {
      severity: 'ERROR',
      code: PG_UNIQUE_VIOLATION,
      constraint_name: 'runs_replay_hash_uidx',
      routine: '_bt_check_unique',
    }),
  });
}

describe('pgErrorCode', () => {
  it('finds the SQLSTATE through the wrapper, from either driver', () => {
    expect(pgErrorCode(pgliteError())).toBe(PG_UNIQUE_VIOLATION);
    expect(pgErrorCode(postgresJsError())).toBe(PG_UNIQUE_VIOLATION);
  });

  it('ignores codes that are not SQLSTATEs', () => {
    // Node's own errors carry a `code` too, and mistaking one for a SQLSTATE would branch on nonsense.
    expect(
      pgErrorCode(Object.assign(new Error('x'), { code: 'ERR_INVALID_ARG_TYPE' })),
    ).toBeUndefined();
    expect(pgErrorCode(new Error('no code at all'))).toBeUndefined();
    expect(pgErrorCode(null)).toBeUndefined();
  });
});

describe('pgConstraintName', () => {
  it('reads PGlite’s spelling', () => {
    expect(pgConstraintName(pgliteError())).toBe('runs_replay_hash_uidx');
  });

  it('reads postgres.js’s spelling', () => {
    expect(pgConstraintName(postgresJsError())).toBe('runs_replay_hash_uidx');
  });

  it('says nothing when the error names no constraint', () => {
    expect(pgConstraintName(new Error('connection refused'))).toBeUndefined();
    expect(pgConstraintName(undefined)).toBeUndefined();
  });
});
