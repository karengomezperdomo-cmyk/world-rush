import { users } from '@worldrush/db';
import { createTestDb } from '@worldrush/db/testing';
import { createManualClock } from '@worldrush/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSession, resolveSession, revokeSession, SESSION_IDLE_TTL_MS } from './session';

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;

async function newUser(): Promise<string> {
  counter += 1;
  const walletAddress = `0x${counter.toString(16).padStart(40, '0')}`;
  const [row] = await ctx.db.insert(users).values({ walletAddress }).returning({ id: users.id });
  if (!row) throw new Error('insert returned no row');
  return row.id;
}

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

describe('createSession / resolveSession', () => {
  it('resolves a freshly created session back to its own user', async () => {
    const userId = await newUser();
    const { token } = await createSession(ctx.db, userId);
    const resolved = await resolveSession(ctx.db, token);
    expect(resolved?.userId).toBe(userId);
  });

  it('rejects an unknown token', async () => {
    expect(await resolveSession(ctx.db, 'not-a-real-token')).toBeNull();
  });

  it('rejects a token past its sliding expiry', async () => {
    const userId = await newUser();
    const clock = createManualClock('2026-01-01T00:00:00Z');
    const { token } = await createSession(ctx.db, userId, clock);
    clock.advance(SESSION_IDLE_TTL_MS + 1_000);
    expect(await resolveSession(ctx.db, token, clock)).toBeNull();
  });

  it('rejects a revoked token immediately', async () => {
    const userId = await newUser();
    const { token } = await createSession(ctx.db, userId);
    await revokeSession(ctx.db, token);
    expect(await resolveSession(ctx.db, token)).toBeNull();
  });

  it('never lets the sliding expiry outlive the absolute cap', async () => {
    const userId = await newUser();
    const clock = createManualClock('2026-01-01T00:00:00Z');
    const { token } = await createSession(ctx.db, userId, clock);

    // Keep "returning" well inside each 30-day idle window (so the slide never naturally lapses) until
    // we're within one idle-TTL of the 90-day absolute cap: each resolve should keep succeeding, capped at
    // the absolute expiry rather than extending 30 days past it.
    const STEP = 20 * 24 * 60 * 60_000; // 20 days: less than SESSION_IDLE_TTL_MS
    for (let i = 0; i < 4; i++) {
      clock.advance(STEP); // day 20, 40, 60, 80
      expect(await resolveSession(ctx.db, token, clock)).not.toBeNull();
    }
    // Day 80's resolve tried to extend to day 110 (80 + 30), but must have been capped at day 90. Advancing
    // past day 90 must now reject it, proving the cap held rather than the naive (uncapped) day-110 value.
    clock.advance(STEP); // day 100: past the 90-day absolute cap
    expect(await resolveSession(ctx.db, token, clock)).toBeNull();
  });
});
