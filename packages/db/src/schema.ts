import {
  APP_ENVS,
  COMPETITION_STATUSES,
  RUN_STATUSES,
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
  jsonb,
  pgTable,
  primaryKey,
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

/**
 * ---------------------------------------------------------------------------
 * Phase 7: competitions, runs and best scores.
 *
 * ## Where this departs from the Phase 0 proposal, and why
 *
 * `docs/phase-0/schema-proposal.sql` models maps as database content — a `maps` catalogue, immutable
 * `map_versions`, and level packages in object storage keyed by `level_asset_key`. That is a sound design
 * for a game whose levels are authored by an admin at runtime. It is not the game that got built: the seven
 * maps are TypeScript constants in `@worldrush/game-core`, compiled into both the client and the server, and
 * there is no asset package to point at.
 *
 * So a map is referenced by its slug — the same `Level.id` that already travels inside every replay — and
 * the two things `map_versions` existed to pin become columns on the competition:
 *
 * - `levelFingerprint`, a fingerprint of the track's playable geometry. Move a ramp and every time set
 *   before the change was measuring a different race, so a submission against a level that no longer
 *   matches is rejected rather than ranked beside the old ones.
 * - `ruleset`, the physics version. Retuning the bike invalidates stored replays just as surely as moving a
 *   ramp does, and nothing in the level data would reveal it.
 *
 * Seasons and weeks are deliberately absent: they are calendar machinery and belong to Phase 8. A
 * competition carries its own open/close window, which is all a leaderboard needs, and `weekStart` groups
 * seven of them without a table so the weekly champion (decision A5) can be computed when that screen exists.
 */

/** One map, open for one day. A leaderboard is scoped to exactly one of these. */
export const competitions = pgTable(
  'competitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** `Level.id` from game-core, e.g. 'sunset-canyon'. Maps live in code, not in this table. */
    mapSlug: text('map_slug').notNull(),
    /** Fingerprint of the track as it was when this competition opened. */
    levelFingerprint: text('level_fingerprint').notNull(),
    /** Physics/engine version; a retune makes older replays unverifiable. */
    ruleset: text('ruleset').notNull(),
    /** The UTC day this belongs to, and the Monday of its week, for grouping. */
    day: timestamptz('day').notNull(),
    weekStart: timestamptz('week_start').notNull(),
    opensAt: timestamptz('opens_at').notNull(),
    closesAt: timestamptz('closes_at').notNull(),
    /**
     * Runs STARTED before the close may still be submitted for this long afterwards. Without it, finishing
     * at 23:59:58 would be unrankable through no fault of the player.
     */
    graceSeconds: integer('grace_seconds').notNull().default(120),
    status: text('status').notNull().default('scheduled'),
    participantsCount: integer('participants_count'),
    winnerTimeMs: integer('winner_time_ms'),
    finalizedAt: timestamptz('finalized_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('competitions_day_uidx').on(t.day),
    uniqueIndex('competitions_week_map_uidx').on(t.weekStart, t.mapSlug),
    index('competitions_window_idx').on(t.opensAt, t.closesAt),
    check('competitions_status_valid', sql`${t.status} in ${inList(COMPETITION_STATUSES)}`),
    check('competitions_window_ordered', sql`${t.closesAt} > ${t.opensAt}`),
    check('competitions_grace_sane', sql`${t.graceSeconds} >= 0`),
  ],
);

/**
 * Every attempt. The replay is the evidence; `durationMs` is the server's own verdict after re-simulating it.
 *
 * `claimedDurationMs` records what the client said, for diagnostics only. A persistent gap between claimed
 * and verified is the signature of a tampered build, and keeping both is what makes that visible.
 */
export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id),
    status: text('status').notNull().default('started'),
    /** Server clock, set when the run is issued — never a timestamp the client sent. */
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    submittedAt: timestamptz('submitted_at'),
    completedAt: timestamptz('completed_at'),
    /** The time the SERVER computed. Null until a replay has been verified. */
    durationMs: integer('duration_ms'),
    /** What the client claimed. Diagnostics only; never ranked. */
    claimedDurationMs: integer('claimed_duration_ms'),
    ruleset: text('ruleset').notNull(),
    clientVersion: text('client_version'),
    replay: bytea('replay'),
    /** sha256 of the replay bytes: the same run submitted twice is one entry, not two. */
    replayHash: bytea('replay_hash'),
    /** What each check concluded, kept so a rejection can be explained and audited. */
    validation: jsonb('validation').notNull().default({}),
    isSuspicious: boolean('is_suspicious').notNull().default(false),
    invalidatedAt: timestamptz('invalidated_at'),
    invalidationReason: text('invalidation_reason'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('runs_user_comp_idx').on(t.userId, t.competitionId, t.startedAt),
    index('runs_comp_status_idx').on(t.competitionId, t.status),
    // Scoped to the competition: the same inputs on two different maps are two legitimate runs.
    uniqueIndex('runs_replay_hash_uidx')
      .on(t.competitionId, t.replayHash)
      .where(sql`${t.replayHash} is not null`),
    check('runs_status_valid', sql`${t.status} in ${inList(RUN_STATUSES)}`),
    check('runs_duration_positive', sql`${t.durationMs} is null or ${t.durationMs} > 0`),
    // A valid run must carry the evidence for its own claim.
    check(
      'runs_valid_is_complete',
      sql`${t.status} <> 'valid' or (${t.durationMs} is not null and ${t.completedAt} is not null)`,
    ),
  ],
);

/**
 * One row per (competition, user): their best verified time.
 *
 * There is no leaderboard table. The leaderboard is an ordered query over this one, which is why the index
 * carries the whole tie-break — time, then who got there first, then user id — so two reads of the same
 * board never disagree about who is third.
 */
export const bestScores = pgTable(
  'best_scores',
  {
    competitionId: uuid('competition_id')
      .notNull()
      .references(() => competitions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bestTimeMs: integer('best_time_ms').notNull(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id),
    /** Tie-break: an equal time set earlier ranks higher. */
    achievedAt: timestamptz('achieved_at').notNull().defaultNow(),
    /** Moderation hides a score from the board without destroying the history behind it. */
    isVisible: boolean('is_visible').notNull().default(true),
    /** Frozen when the competition is finalized. */
    finalRank: integer('final_rank'),
    updatedAt: timestamptz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.competitionId, t.userId] }),
    index('best_scores_rank_idx')
      .on(t.competitionId, t.bestTimeMs, t.achievedAt, t.userId)
      .where(sql`${t.isVisible}`),
    index('best_scores_user_idx').on(t.userId, t.achievedAt),
    uniqueIndex('best_scores_final_rank_uidx')
      .on(t.competitionId, t.finalRank)
      .where(sql`${t.finalRank} is not null`),
    check('best_scores_time_positive', sql`${t.bestTimeMs} > 0`),
  ],
);
