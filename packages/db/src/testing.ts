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
 * A private schema on a real server.
 *
 * A schema rather than a database because creating a database per test file is slow and cannot be done from
 * inside a pool connected to another one. The connection's `search_path` points at it, so the migrations —
 * which name no schema — build the whole thing inside it, and dropping it afterwards leaves nothing behind.
 * The migration bookkeeping table goes in the same schema, so parallel test files never fight over it.
 *
 * More than one connection on purpose: a pool of one would make this engine behave exactly like the embedded
 * one, which would defeat the point of running against it.
 */
async function createPostgresTestDb(databaseUrl: string, environment: AppEnv): Promise<TestDb> {
  const schema = `test_${randomBytes(6).toString('hex')}`;

  const admin = createHostedDb({ databaseUrl });
  try {
    await admin.db.execute(sql.raw(`create schema "${schema}"`));
  } finally {
    await admin.close();
  }

  const scoped = createHostedDb({
    databaseUrl,
    maxConnections: 5,
    driverOptions: { connection: { search_path: schema } },
  });
  await migrateHosted(scoped.db as Parameters<typeof migrateHosted>[0], {
    migrationsFolder,
    migrationsSchema: schema,
  });
  await markDatabaseEnvironment(scoped.db, environment);

  return {
    db: scoped.db,
    engine: 'postgres',
    close: async () => {
      await scoped.close();
      const cleanup = createHostedDb({ databaseUrl });
      try {
        await cleanup.db.execute(sql.raw(`drop schema "${schema}" cascade`));
      } finally {
        await cleanup.close();
      }
    },
  };
}
