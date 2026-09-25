import { describe, expect, it } from 'vitest';
import { EnvironmentConfigError, parseServerEnv } from './env';

const dev = { APP_ENV: 'development', NEXT_PUBLIC_APP_ENV: 'development' };
const hosted = 'postgres://app@db.example.com:5432/app';
const origin = 'https://rush7-staging.example.com';

function issuesOf(source: Record<string, string | undefined>): readonly string[] {
  try {
    parseServerEnv(source);
  } catch (error) {
    if (error instanceof EnvironmentConfigError) return error.issues;
    throw error;
  }
  return [];
}

describe('parseServerEnv', () => {
  it('accepts a minimal development environment with every feature flag OFF', () => {
    const config = parseServerEnv(dev);
    expect(config).toEqual({
      appEnv: 'development',
      isProduction: false,
      databaseUrl: undefined,
      appOrigin: 'http://localhost:3000',
      flags: { ranked: false, rewards: false, notifications: false },
    });
  });

  it('fails loudly when APP_ENV is missing (no silent default to development)', () => {
    expect(issuesOf({ NEXT_PUBLIC_APP_ENV: 'development' })).toEqual([
      expect.stringContaining('APP_ENV'),
    ]);
    expect(issuesOf({})).toHaveLength(2);
  });

  it('rejects unknown environment names', () => {
    expect(issuesOf({ APP_ENV: 'prod', NEXT_PUBLIC_APP_ENV: 'prod' }).length).toBeGreaterThan(0);
  });

  it('requires the public and server environment names to match', () => {
    expect(issuesOf({ APP_ENV: 'development', NEXT_PUBLIC_APP_ENV: 'production' })).toEqual([
      expect.stringContaining('must equal APP_ENV'),
    ]);
  });

  it('treats empty strings as not set', () => {
    expect(parseServerEnv({ ...dev, DATABASE_URL: '' }).databaseUrl).toBeUndefined();
  });

  it('parses feature flags only from the exact strings true/false', () => {
    const config = parseServerEnv({ ...dev, RANKED_ENABLED: 'true', REWARDS_ENABLED: 'false' });
    expect(config.flags).toEqual({ ranked: true, rewards: false, notifications: false });
    expect(issuesOf({ ...dev, RANKED_ENABLED: 'yes' }).length).toBeGreaterThan(0);
  });

  describe('outside development', () => {
    const staging = { APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', APP_ORIGIN: origin };

    it('requires a hosted DATABASE_URL', () => {
      expect(issuesOf(staging)).toEqual([expect.stringContaining('DATABASE_URL is required')]);
      expect(issuesOf({ ...staging, DATABASE_URL: 'pglite://memory' })).toEqual([
        expect.stringContaining('hosted Postgres'),
      ]);
      expect(issuesOf({ ...staging, DATABASE_URL: 'postgres://u@localhost:5432/db' })).toEqual([
        expect.stringContaining('hosted Postgres'),
      ]);
      expect(parseServerEnv({ ...staging, DATABASE_URL: hosted }).appEnv).toBe('staging');
    });

    it('requires APP_ORIGIN', () => {
      const withoutOrigin = {
        APP_ENV: 'staging',
        NEXT_PUBLIC_APP_ENV: 'staging',
        DATABASE_URL: hosted,
      };
      expect(issuesOf(withoutOrigin)).toEqual([expect.stringContaining('APP_ORIGIN is required')]);
      expect(issuesOf({ ...withoutOrigin, APP_ORIGIN: 'not-a-url' }).length).toBeGreaterThan(0);
      expect(parseServerEnv({ ...staging, DATABASE_URL: hosted }).appOrigin).toBe(origin);
    });
  });

  describe('Vercel cross-checks (a preview can never boot as production, and vice versa)', () => {
    const prod = {
      APP_ENV: 'production',
      NEXT_PUBLIC_APP_ENV: 'production',
      DATABASE_URL: hosted,
      APP_ORIGIN: origin,
    };

    it('production deployment must be APP_ENV=production', () => {
      expect(issuesOf({ ...dev, VERCEL_ENV: 'production' })).toEqual([
        expect.stringContaining('VERCEL_ENV=production requires APP_ENV=production'),
      ]);
      expect(
        issuesOf({
          APP_ENV: 'staging',
          NEXT_PUBLIC_APP_ENV: 'staging',
          DATABASE_URL: hosted,
          APP_ORIGIN: origin,
          VERCEL_ENV: 'production',
        }),
      ).toEqual([expect.stringContaining('requires APP_ENV=production')]);
    });

    it('APP_ENV=production is refused on preview and development deployments', () => {
      expect(issuesOf({ ...prod, VERCEL_ENV: 'preview' })).toEqual([
        expect.stringContaining('only allowed on the production deployment'),
      ]);
      expect(issuesOf({ ...prod, VERCEL_ENV: 'development' })).toEqual([
        expect.stringContaining('only allowed on the production deployment'),
      ]);
    });

    it('allows the coherent combinations', () => {
      expect(parseServerEnv({ ...prod, VERCEL_ENV: 'production' }).isProduction).toBe(true);
      expect(parseServerEnv(prod).isProduction).toBe(true); // non-Vercel host
      expect(
        parseServerEnv({
          APP_ENV: 'staging',
          NEXT_PUBLIC_APP_ENV: 'staging',
          DATABASE_URL: hosted,
          APP_ORIGIN: origin,
          VERCEL_ENV: 'preview',
        }).appEnv,
      ).toBe('staging');
    });
  });

  it('refuses secret-like NEXT_PUBLIC_* variables and never echoes their values', () => {
    const issues = issuesOf({
      ...dev,
      NEXT_PUBLIC_RP_SIGNING_KEY: 'super-secret-value',
      NEXT_PUBLIC_DATABASE_URL: 'postgres://user:hunter2@host/db', // guard:allow url-with-credentials (fake fixture)
    });
    expect(issues).toHaveLength(2);
    expect(issues.join('\n')).not.toContain('super-secret-value');
    expect(issues.join('\n')).not.toContain('hunter2');
  });

  it('allows harmless NEXT_PUBLIC_* variables', () => {
    expect(() => parseServerEnv({ ...dev, NEXT_PUBLIC_WORLD_APP_ID: 'app_123' })).not.toThrow();
  });
});
