import { randomBytes } from 'node:crypto';
import type { AppEnv } from '@worldrush/shared';
import { sql } from 'drizzle-orm';
import { migrate as migrateHosted } from 'drizzle-orm/postgres-js/migrator';
import {
  applyMigrations,
  createHostedDb,
  createLocalDb,
  migrationsFolder,
  type Db,
} from './client';
import { markDatabaseEnvironment } from './guard';

/**
 * The database a test runs against.
 *
 * Two engines, same schema. Which one is used is decided by `TEST_DATABASE_URL`:
 *
 * - **unset (the default):** PGlite, an embedded PostgreSQL. No server to install, no cleanup, and every
 *   test file gets its own private database. It has one limitation that matters: a single connection, so two
 *   transactions can never be in flight at once, and anything that depends on one waiting for another —
 *   `select … for update`, deadlock handling, commit ordering — simply cannot happen there.
 * - **set:** a real PostgreSQL server, one schema per call, dropped afterwards. This is what CI uses for a
 *   second pass over the same suite, and it is the only place the locking paths are genuinely exercised.
 *
 * The split exists so the everyday loop stays fast and dependency-free while the claims about concurrency
 * stay honest. See `packages/runs/src/races.test.ts`.
 */
export interface TestDb {
  readonly db: Db;
  /** Which engine this database is, for tests that must skip what one of them cannot express. */
  readonly engine: 'pglite' | 'postgres';
  close(): Promise<void>;
}

/** Whether the suite is pointed at a real PostgreSQL server rather than the embedded one. */
export function usingRealPostgres(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL);
}

/** Fresh database with every migration applied and the environment marker set. */
export async function createTestDb(environment: AppEnv = 'development'): Promise<TestDb> {
  const url = process.env.TEST_DATABASE_URL;
  return url ? createPostgresTestDb(url, environment) : createEmbeddedTestDb(environment);
}

async function createEmbeddedTestDb(environment: AppEnv): Promise<TestDb> {
  const local = await createLocalDb();
  await applyMigrations(local.db);
  await markDatabaseEnvironment(local.db, environment);
  return { db: local.db, engine: 'pglite', close: local.close };
}

/**
 * A private DATABASE on a real server, one per test file.
 *
 * It was a private schema first, with the connection's `search_path` pointed at it, which is lighter and
 * would have been fine — except that Drizzle's generated migrations qualify their foreign keys:
 * `references "public"."users"`. Under a search_path the tables land in the private schema while the
 * constraint still looks in `public`, so the very first migration fails with `relation "public.users" does
 * not exist`. CI found that on the job's first ever run; nothing local could have, because there is no
 * PostgreSQL on the development machine.
 *
 * A database of its own gives each test file its own `public`, which is exactly what those migrations
 * expect, and dropping it afterwards leaves nothing behind. `CREATE DATABASE` cannot run inside a
 * transaction and cannot be issued from a pool connected to the database being created, so both the create
 * and the drop go through their own short-lived connection to the server's original database.
 *
 * The pool has more than one connection on purpose: a pool of one would behave exactly like the embedded
 * engine, which would defeat the point of running against this one.
 */
async function createPostgresTestDb(databaseUrl: string, environment: AppEnv): Promise<TestDb> {
  const name = `test_${randomBytes(6).toString('hex')}`;

  const admin = createHostedDb({ databaseUrl });
  try {
    await admin.db.execute(sql.raw(`create database "${name}"`));
  } finally {
    await admin.close();
  }

  const scoped = createHostedDb({
    databaseUrl: withDatabase(databaseUrl, name),
    maxConnections: 5,
  });
  await migrateHosted(scoped.db as Parameters<typeof migrateHosted>[0], { migrationsFolder });
  await markDatabaseEnvironment(scoped.db, environment);

  return {
    db: scoped.db,
    engine: 'postgres',
    close: async () => {
      await scoped.close();
      const cleanup = createHostedDb({ databaseUrl });
      try {
        // FORCE because a connection that outlived the pool would otherwise block the drop and leak the
        // database into the next run.
        await cleanup.db.execute(sql.raw(`drop database if exists "${name}" with (force)`));
      } finally {
        await cleanup.close();
      }
    },
  };
}

/** The same server, a different database. */
function withDatabase(databaseUrl: string, name: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}
