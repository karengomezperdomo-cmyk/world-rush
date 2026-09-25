import {
  APP_ENVS,
  USER_STATUSES,
  WORLD_ID_ENVIRONMENTS,
  WORLD_ID_PROTOCOL_VERSIONS,
} from '@worldrush/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Phase 1 schema: identity and environment guard only (the tables authentication needs).
 * The rest of docs/phase-0/schema-proposal.sql (calendar, runs, best_scores, triggers, functions)
 * arrives in Phase 4 as further migrations, keeping SQL that Drizzle cannot express in custom migrations.
 *
 * Conventions: timestamptz (UTC) everywhere; statuses are text + CHECK; the database clock is authoritative.
 */

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});
/** Renders ('a', 'b') for CHECK ... IN (...) from a const tuple. */
const inList = (values: readonly string[]) =>
  sql.raw(`(${values.map((value) => `'${value}'`).join(', ')})`);

/** Singleton row that marks which environment a database belongs to (staging code must never open production data). */
export const systemMeta = pgTable(
  'system_meta',
  {
    id: boolean('id').primaryKey().default(true),
    environment: text('environment').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('system_meta_singleton', sql`${t.id}`),
    check('system_meta_environment_valid', sql`${t.environment} in ${inList(APP_ENVS)}`),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** SIWE-verified wallet address, always lowercase. This is the authentication identifier. */
    walletAddress: text('wallet_address').notNull(),
    /** Cache of the World usernames service, resolved on the server (never trusted from the client). */
    username: text('username'),
    avatarUrl: text('avatar_url'),
    profileSyncedAt: timestamptz('profile_synced_at'),
    locale: text('locale'),
    status: text('status').notNull().default('active'),
    /** Derived from world_id_verifications (convenience for queries). */
    humanVerifiedAt: timestamptz('human_verified_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    lastLoginAt: timestamptz('last_login_at'),
  },
  (t) => [
    uniqueIndex('users_wallet_uidx').on(t.walletAddress),
    check('users_wallet_format', sql`${t.walletAddress} ~ '^0x[0-9a-f]{40}$'`),
    check('users_status_valid', sql`${t.status} in ${inList(USER_STATUSES)}`),
  ],
);

/** Single-use SIWE nonces (valid across serverless instances). */
export const authNonces = pgTable(
  'auth_nonces',
  {
    nonce: text('nonce').primaryKey(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(),
    consumedAt: timestamptz('consumed_at'),
  },
  (t) => [
    check('auth_nonces_format', sql`${t.nonce} ~ '^[A-Za-z0-9]{16,64}$'`),
    index('auth_nonces_expires_idx').on(t.expiresAt),
  ],
);

/** Opaque, revocable sessions. Only the HASH of the token is stored, never the token. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: bytea('token_hash').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
    /** Sliding expiry. */
    expiresAt: timestamptz('expires_at').notNull(),
    /** Hard cap regardless of activity. */
    absoluteExpiresAt: timestamptz('absolute_expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_uidx').on(t.tokenHash),
    index('sessions_user_active_idx')
      .on(t.userId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

/**
 * Proof of humanity (World ID). Only the nullifier and minimal metadata are stored: the nullifier is
 * non-reversible and scoped to (app, action). The Developer Portal accepts repeated nullifiers, so
 * "one human, one account" is enforced HERE by the unique constraints.
 */
export const worldIdVerifications = pgTable(
  'world_id_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    /** 256-bit field element; returned as a decimal string (never a JS number). */
    nullifier: numeric('nullifier', { precision: 78, scale: 0 }).notNull(),
    protocolVersion: text('protocol_version').notNull(),
    credential: text('credential').notNull(),
    environment: text('environment').notNull(),
    verifiedAt: timestamptz('verified_at').notNull().defaultNow(),
  },
  (t) => [
    unique('wid_action_nullifier_uq').on(t.action, t.nullifier),
    unique('wid_user_action_uq').on(t.userId, t.action),
    check('wid_nullifier_non_negative', sql`${t.nullifier} >= 0`),
    check('wid_protocol_valid', sql`${t.protocolVersion} in ${inList(WORLD_ID_PROTOCOL_VERSIONS)}`),
    check('wid_environment_valid', sql`${t.environment} in ${inList(WORLD_ID_ENVIRONMENTS)}`),
  ],
);
