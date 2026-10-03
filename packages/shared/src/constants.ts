/** The three isolated environments (docs/phase-0/02-architecture-proposal.md §12). */
export const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const USER_STATUSES = ['active', 'suspended', 'banned', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** World ID proof protocol versions accepted by the verify endpoint. */
export const WORLD_ID_PROTOCOL_VERSIONS = ['3.0', '4.0'] as const;
export type WorldIdProtocolVersion = (typeof WORLD_ID_PROTOCOL_VERSIONS)[number];

/** World ID request environments (staging = Simulator only; production = real World App). */
export const WORLD_ID_ENVIRONMENTS = ['production', 'staging'] as const;
export type WorldIdEnvironment = (typeof WORLD_ID_ENVIRONMENTS)[number];

/**
 * Phase 7. A competition's lifecycle is driven by the clock, not by this column: `scheduled` and `open` are
 * derived from `opens_at`/`closes_at`, and the column only caches the two states a clock cannot express.
 */
export const COMPETITION_STATUSES = [
  'scheduled',
  'open',
  'closed',
  'finalized',
  'cancelled',
] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

/**
 * A run's lifecycle. `started` is issued by the server before play; `verifying` is set while the replay is
 * being re-simulated; a run only becomes `valid` once the server has computed the time itself.
 */
export const RUN_STATUSES = [
  'started',
  'verifying',
  'valid',
  'invalid',
  'abandoned',
  'expired',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
