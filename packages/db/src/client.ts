import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzleHosted } from 'drizzle-orm/postgres-js';
import { migrate as migrateHosted } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Database handle, satisfied by both drivers: the embedded PostgreSQL (PGlite) used for local development
 * and tests, and the hosted Postgres added in Phase 4. It is deliberately the shared `PgDatabase`
 * supertype rather than either concrete type, so nothing outside this file can depend on which one it got.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// NOT `new URL('../migrations', import.meta.url)`: Next.js's Turbopack production build statically
// pattern-matches that exact `new URL(literal, import.meta.url)` shape and tries to resolve it as a
// bundleable asset, which fails since `migrations/` holds runtime-read `.sql` files, not a JS/asset import
// (confirmed 2026-09-24: `pnpm build` only started reaching this file once apps/web began importing
// @worldrush/db in Phase 2, and failed with "Module not found"). Computing the same path in two steps
// produces an identical runtime string without tripping that special case.
export const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../migrations');

export interface LocalDb {
  db: Db;
  client: PGlite;
  close(): Promise<void>;
}

/**
 * Embedded PostgreSQL: in-memory when `dataDir` is omitted, persistent on disk otherwise. `PGlite.create`
 * only creates the final path component itself, not its parents (confirmed 2026-09-24 by actually running
 * the dev server against a fresh checkout: `ENOENT` on the very first request, never hit by the test suite
 * because tests only ever use the in-memory, no-`dataDir` mode) — so this creates the whole directory
 * (recursive) first.
 */
export async function createLocalDb(options: { dataDir?: string } = {}): Promise<LocalDb> {
  if (options.dataDir) await mkdir(options.dataDir, { recursive: true });
  const client = await PGlite.create(options.dataDir);
  const db = drizzle(client, { schema });
  return { db, client, close: () => client.close() };
}

export async function applyMigrations(db: Db): Promise<void> {
  await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder });
}

export interface HostedDb {
  db: Db;
  client: postgres.Sql;
  close(): Promise<void>;
}

/**
 * Hosted Postgres (Neon, Supabase, or anything else that speaks the wire protocol — `postgres.js` is
 * driver-agnostic on purpose, so changing provider does not mean rewriting this).
 *
 * `max: 1` because this runs in serverless functions: each invocation gets its own short-lived instance,
 * so a larger pool here would not be reused, it would just multiply idle connections against the provider's
 * limit. Point `DATABASE_URL` at the provider's *pooled* endpoint for the same reason.
 *
 * Migrations are NOT applied here. On a hosted database that is a deliberate, separate step
 * (`pnpm db:provision`), never something a request path does: concurrent cold starts would race each other,
 * and a half-finished schema change is not something to discover mid-request.
 */
export function createHostedDb(options: {
  databaseUrl: string;
  maxConnections?: number;
}): HostedDb {
  const client = postgres(options.databaseUrl, {
    max: options.maxConnections ?? 1,
    // The default would silently coerce; failing loudly is the house style for anything schema-shaped.
    onnotice: () => {},
  });
  const db = drizzleHosted(client, { schema });
  return { db, client, close: () => client.end() };
}

/** Applies migrations to a hosted database. Provisioning/deploy step only — see `createHostedDb`. */
export async function applyHostedMigrations(db: Db): Promise<void> {
  await migrateHosted(db as Parameters<typeof migrateHosted>[0], { migrationsFolder });
}
