import type { AppEnv } from '@worldrush/shared';
import type { Db } from './client';
import { systemMeta } from './schema';

export class DatabaseEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseEnvironmentError';
  }
}

/**
 * Refuses to run when the database belongs to another environment, so staging or development code
 * can never write to the production leaderboard by mistake. Call it once at server start.
 */
export async function assertDatabaseEnvironment(db: Db, expected: AppEnv): Promise<void> {
  const [row] = await db.select({ environment: systemMeta.environment }).from(systemMeta).limit(1);
  if (!row) {
    throw new DatabaseEnvironmentError(
      'The database has no environment marker (system_meta is empty). Refusing to start.',
    );
  }
  if (row.environment !== expected) {
    throw new DatabaseEnvironmentError(
      `Refusing to start: APP_ENV=${expected} but this database is marked as "${row.environment}".`,
    );
  }
}

/**
 * Marks a NEW database with its environment (a deliberate, one-time provisioning step).
 * Idempotent, and it can never relabel a database that already has a different marker.
 */
export async function markDatabaseEnvironment(db: Db, environment: AppEnv): Promise<void> {
  await db.insert(systemMeta).values({ environment }).onConflictDoNothing();
  await assertDatabaseEnvironment(db, environment);
}
