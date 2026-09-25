import { describe, expect, it } from 'vitest';
import { createHostedDb } from './client';

// No credentials in these URLs on purpose: `scripts/check-public-env.mjs` refuses any committed URL that
// embeds them, and a test that never opens a connection has no use for them anyway.
const UNREACHABLE_DB_URL = 'postgres://db.example.invalid:5432/rush7';

describe('createHostedDb', () => {
  /**
   * There is no hosted database to point at in CI, so this covers what can be checked without one: the
   * wiring is sound and nothing dials out until a query is actually made. `postgres.js` connects lazily,
   * which is what makes the serverless usage in `apps/web/src/lib/db.ts` viable — constructing the handle
   * during a cold start must not cost a round trip.
   */
  it('builds a handle without connecting, and closes cleanly', async () => {
    const hosted = createHostedDb({ databaseUrl: UNREACHABLE_DB_URL });

    expect(hosted.db).toBeDefined();
    expect(typeof hosted.db.select).toBe('function');
    // An eager connection to a .invalid host would have thrown or hung by now.
    await expect(hosted.close()).resolves.not.toThrow();
  });

  it('defaults to a single connection, because each serverless invocation gets its own instance', () => {
    const hosted = createHostedDb({ databaseUrl: UNREACHABLE_DB_URL });
    expect(hosted.client.options.max).toBe(1);
    void hosted.close();
  });
});
