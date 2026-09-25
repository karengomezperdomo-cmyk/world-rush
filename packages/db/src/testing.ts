import type { AppEnv } from '@worldrush/shared';
import { applyMigrations, createLocalDb, type LocalDb } from './client';
import { markDatabaseEnvironment } from './guard';

/** Fresh in-memory database with every migration applied and the environment marker set. */
export async function createTestDb(environment: AppEnv = 'development'): Promise<LocalDb> {
  const local = await createLocalDb();
  await applyMigrations(local.db);
  await markDatabaseEnvironment(local.db, environment);
  return local;
}
