#!/usr/bin/env node
/**
 * Provisions a HOSTED Postgres database: applies the migrations, then stamps it with the environment it
 * belongs to.
 *
 * Deliberately a separate, manual step — never something a request path does. On serverless, several cold
 * starts can begin at once, and letting them race to migrate the same database is how you end up
 * discovering a half-applied schema change mid-request (`apps/web/src/lib/db.ts` only verifies the marker).
 *
 * Plain JavaScript on purpose: Node cannot execute this repo's TypeScript sources directly (they use
 * extensionless imports, which ESM does not resolve), and adding a TS runner just for this would be a
 * dependency for one script.
 *
 * Usage, from the repo root, with the values for the environment you are provisioning:
 *   DATABASE_URL='postgres://…' APP_ENV=production pnpm db:provision
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const VALID_ENVIRONMENTS = ['development', 'staging', 'production'];

const databaseUrl = process.env.DATABASE_URL;
const appEnv = process.env.APP_ENV;

if (!databaseUrl) fail('DATABASE_URL is required.');
if (!appEnv) fail('APP_ENV is required.');
if (!VALID_ENVIRONMENTS.includes(appEnv)) {
  fail(`APP_ENV must be one of: ${VALID_ENVIRONMENTS.join(', ')} (got "${appEnv}").`);
}
if (/localhost|127\.0\.0\.1/.test(databaseUrl)) {
  fail('DATABASE_URL points at localhost. This script is for hosted databases only.');
}

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });

try {
  await migrate(drizzle(client), { migrationsFolder });
  console.log('migrations applied');

  // Mirrors markDatabaseEnvironment in packages/db/src/guard.ts: insert once, never relabel. The CHECK
  // constraints in the migration are what actually enforce singleton-ness and a valid environment value.
  await client`INSERT INTO system_meta (environment) VALUES (${appEnv}) ON CONFLICT DO NOTHING`;

  const [row] = await client`SELECT environment FROM system_meta LIMIT 1`;
  if (!row) fail('system_meta is still empty after provisioning.');
  if (row.environment !== appEnv) {
    fail(
      `This database is already marked as "${row.environment}", but APP_ENV=${appEnv}. ` +
        'Refusing to relabel it — point at the right database, or provision a new one.',
    );
  }
  console.log(`database marked as "${row.environment}"`);
} finally {
  await client.end();
}

function fail(message) {
  console.error(`db-provision: ${message}`);
  process.exit(1);
}
