import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyMigrations,
  assertDatabaseEnvironment,
  createHostedDb,
  createLocalDb,
  markDatabaseEnvironment,
  type Db,
} from '@worldrush/db';
import { getServerConfig } from './server-env';

let cached: Promise<Db> | undefined;

/**
 * Server-side database handle, memoized for the life of the process. Never import this from a client
 * component.
 *
 * Development (the default: no DATABASE_URL set): an embedded PostgreSQL (PGlite), persisted to
 * `.data/dev-db` (git-ignored) so data survives restarts of `next dev`. Migrations are applied on first
 * use, which is safe here because there is exactly one process.
 *
 * Staging/production (DATABASE_URL set): hosted Postgres. Migrations are NOT applied here — that is a
 * deploy step (`pnpm db:provision`), since concurrent cold starts would otherwise race to migrate the same
 * database. This only verifies the environment marker, so a staging build can never talk to the production
 * database by mistake.
 */
export function getDb(): Promise<Db> {
  cached ??= initDb();
  return cached;
}

async function initDb(): Promise<Db> {
  const config = getServerConfig();
  if (config.databaseUrl) {
    const hosted = createHostedDb({ databaseUrl: config.databaseUrl });
    await assertDatabaseEnvironment(hosted.db, config.appEnv);
    return hosted.db;
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
