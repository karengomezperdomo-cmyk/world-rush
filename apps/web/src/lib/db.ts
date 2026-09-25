import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyMigrations, createLocalDb, markDatabaseEnvironment, type Db } from '@worldrush/db';
import { getServerConfig } from './server-env';

let cached: Promise<Db> | undefined;

/**
 * Server-side database handle, memoized for the life of the process. Never import this from a client
 * component.
 *
 * Development (the default: no DATABASE_URL set): an embedded PostgreSQL (PGlite), persisted to
 * `.data/dev-db` (git-ignored) so data survives restarts of `next dev`.
 *
 * Staging/production: NOT YET IMPLEMENTED. `packages/db` only has the embedded driver so far — the hosted
 * Postgres driver is Phase 4 work (docs/DECISIONS.md §4, "the hosted driver ... is added in Phase 4 behind
 * this same type"). This throws instead of silently opening the wrong database.
 */
export function getDb(): Promise<Db> {
  cached ??= initDb();
  return cached;
}

async function initDb(): Promise<Db> {
  const config = getServerConfig();
  if (config.databaseUrl) {
    throw new Error(
      'DATABASE_URL is set, but packages/db has no hosted Postgres driver yet (Phase 4, see ' +
        'docs/DECISIONS.md §4). Unset DATABASE_URL to use the embedded development database instead.',
    );
  }
  // Not `new URL('../../.data/dev-db', import.meta.url)`: Turbopack's production build statically
  // pattern-matches that exact shape as an asset import and fails to resolve a directory that doesn't
  // exist until this code actually runs (packages/db/src/client.ts hit the identical issue; see its
  // comment). Two steps instead of one produces the same runtime path without tripping that special case.
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), '../../.data/dev-db');
  const local = await createLocalDb({ dataDir });
  await applyMigrations(local.db);
  await markDatabaseEnvironment(local.db, config.appEnv); // also asserts: refuses a mismatched marker
  return local.db;
}
