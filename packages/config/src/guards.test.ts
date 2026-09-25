import { describe, expect, it } from 'vitest';
import {
  assertDevelopmentOnly,
  findSecretLikePublicKeys,
  isLocalDatabaseUrl,
  SECRET_LIKE_NAME,
} from './guards';

describe('findSecretLikePublicKeys', () => {
  it.each([
    'NEXT_PUBLIC_RP_SIGNING_KEY',
    'NEXT_PUBLIC_API_KEY',
    'NEXT_PUBLIC_APIKEY',
    'NEXT_PUBLIC_DEV_PORTAL_API_KEY',
    'NEXT_PUBLIC_DATABASE_URL',
    'NEXT_PUBLIC_SESSION_SECRET',
    'NEXT_PUBLIC_ADMIN_PASSWORD',
    'NEXT_PUBLIC_HMAC_KEY',
    'NEXT_PUBLIC_PRIVATE_THING',
  ])('flags %s', (name) => {
    expect(findSecretLikePublicKeys({ [name]: 'x' })).toHaveLength(1);
  });

  it('ignores non-public variables (server secrets are fine on the server) and harmless public ones', () => {
    expect(
      findSecretLikePublicKeys({
        RP_SIGNING_KEY: 'x',
        DATABASE_URL: 'x',
        NEXT_PUBLIC_APP_ENV: 'development',
        NEXT_PUBLIC_WORLD_APP_ID: 'app_123',
        NEXT_PUBLIC_RP_ID: 'rp_123',
      }),
    ).toEqual([]);
  });
});

describe('isLocalDatabaseUrl', () => {
  it.each([
    'pglite://memory',
    'file:./dev.db',
    'memory://',
    'postgres://u@localhost:5432/db',
    'postgres://u@127.0.0.1/db',
    'postgres://u@[::1]:5432/db',
  ])('%s is local', (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it.each([
    'postgres://u@ep-cool-name.us-east-2.aws.neon.tech/db',
    'postgresql://u@db.example.com:5432/app',
  ])('%s is hosted', (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(false);
  });
});

describe('assertDevelopmentOnly', () => {
  it('passes in development and throws elsewhere', () => {
    expect(() => assertDevelopmentOnly('development', 'dev-login')).not.toThrow();
    expect(() => assertDevelopmentOnly('staging', 'dev-login')).toThrow(/dev-login/);
    expect(() => assertDevelopmentOnly('production', 'dev-login')).toThrow(/APP_ENV=production/);
  });
});

describe('SECRET_LIKE_NAME', () => {
  it('is exported so the repository scan can be tested against the same pattern', () => {
    expect(SECRET_LIKE_NAME.test('NEXT_PUBLIC_TOKEN')).toBe(true);
  });
});
