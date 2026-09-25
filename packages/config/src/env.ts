import { APP_ENVS, type AppEnv } from '@worldrush/shared';
import { z } from 'zod';
import { findSecretLikePublicKeys, isLocalDatabaseUrl } from './guards';

const ENV_ERROR = 'must be one of: development, staging, production';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const serverEnvSchema = z.object({
  // No default on purpose: a missing APP_ENV must fail loudly, never silently become "development".
  APP_ENV: z.enum(APP_ENVS, { error: `APP_ENV ${ENV_ERROR}` }),
  NEXT_PUBLIC_APP_ENV: z.enum(APP_ENVS, { error: `NEXT_PUBLIC_APP_ENV ${ENV_ERROR}` }),
  DATABASE_URL: z.string().min(1).optional(),
  /** Our own canonical origin, e.g. "https://rush7.example.com". Required outside development: it anchors
   *  the SIWE domain/uri hardening check (packages/auth/src/wallet-auth.ts) and cookie decisions. */
  APP_ORIGIN: z
    .url({ error: 'APP_ORIGIN must be a valid absolute URL, e.g. https://rush7.example.com' })
    .optional(),
  /** Provided by Vercel itself; used only to cross-check APP_ENV. */
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  RANKED_ENABLED: flag,
  REWARDS_ENABLED: flag,
  NOTIFICATIONS_ENABLED: flag,
});

export interface ServerConfig {
  appEnv: AppEnv;
  isProduction: boolean;
  databaseUrl: string | undefined;
  /** Falls back to "http://localhost:3000" in development when unset; required otherwise. */
  appOrigin: string;
  /** Feature flags. All default to OFF; enabling any of them requires explicit approval. */
  flags: { ranked: boolean; rewards: boolean; notifications: boolean };
}

export class EnvironmentConfigError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n- ${issues.join('\n- ')}`);
    this.name = 'EnvironmentConfigError';
    this.issues = issues;
  }
}

/**
 * Validates the server environment as a whole and refuses incoherent combinations, so a preview or
 * staging deployment can never boot as production (and vice versa). Never logs values, only names.
 */
export function parseServerEnv(source: Readonly<Record<string, string | undefined>>): ServerConfig {
  // Empty strings (e.g. `DATABASE_URL=`) are treated as "not set".
  const normalized = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );

  const parsed = serverEnvSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new EnvironmentConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  const env = parsed.data;

  const issues: string[] = [];
  if (env.NEXT_PUBLIC_APP_ENV !== env.APP_ENV) {
    issues.push(
      `NEXT_PUBLIC_APP_ENV (${env.NEXT_PUBLIC_APP_ENV}) must equal APP_ENV (${env.APP_ENV})`,
    );
  }
  if (env.APP_ENV !== 'development') {
    if (!env.DATABASE_URL) {
      issues.push(`DATABASE_URL is required when APP_ENV=${env.APP_ENV}`);
    } else if (isLocalDatabaseUrl(env.DATABASE_URL)) {
      issues.push(`DATABASE_URL must be a hosted Postgres URL when APP_ENV=${env.APP_ENV}`);
    }
    if (!env.APP_ORIGIN) {
      issues.push(`APP_ORIGIN is required when APP_ENV=${env.APP_ENV}`);
    }
  }
  if (env.VERCEL_ENV === 'production' && env.APP_ENV !== 'production') {
    issues.push(`VERCEL_ENV=production requires APP_ENV=production (got APP_ENV=${env.APP_ENV})`);
  }
  if (
    env.APP_ENV === 'production' &&
    env.VERCEL_ENV !== undefined &&
    env.VERCEL_ENV !== 'production'
  ) {
    issues.push(
      `APP_ENV=production is only allowed on the production deployment (VERCEL_ENV=${env.VERCEL_ENV})`,
    );
  }
  issues.push(...findSecretLikePublicKeys(source));

  if (issues.length > 0) throw new EnvironmentConfigError(issues);

  return {
    appEnv: env.APP_ENV,
    isProduction: env.APP_ENV === 'production',
    databaseUrl: env.DATABASE_URL,
    appOrigin: env.APP_ORIGIN ?? 'http://localhost:3000',
    flags: {
      ranked: env.RANKED_ENABLED,
      rewards: env.REWARDS_ENABLED,
      notifications: env.NOTIFICATIONS_ENABLED,
    },
  };
}
