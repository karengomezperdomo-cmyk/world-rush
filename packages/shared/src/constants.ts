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
