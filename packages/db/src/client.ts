import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';

/**
 * Database handle. Phase 1 supports the embedded PostgreSQL (PGlite) used for local development and
 * tests. The hosted driver (Postgres on Vercel) is added in Phase 4 behind this same type.
 */
export type Db = PgliteDatabase<typeof schema>;

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
  await migrate(db, { migrationsFolder });
}
