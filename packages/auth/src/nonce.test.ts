import { createTestDb } from '@worldrush/db/testing';
import { createManualClock } from '@worldrush/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { consumeNonce, issueNonce, NONCE_TTL_MS } from './nonce';

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

describe('issueNonce', () => {
  it('issues an alphanumeric nonce with the TTL anchored to the given clock', async () => {
    const clock = createManualClock('2026-01-01T00:00:00Z');
    const { nonce, expiresAt } = await issueNonce(ctx.db, clock);
    expect(nonce).toMatch(/^[a-f0-9]{48}$/); // satisfies both MiniKit's rule and the DB's 16-64 check
    expect(expiresAt.getTime()).toBe(clock.now().getTime() + NONCE_TTL_MS);
  });

  it('issues a different nonce every call', async () => {
    const a = await issueNonce(ctx.db);
    const b = await issueNonce(ctx.db);
    expect(a.nonce).not.toBe(b.nonce);
  });
});

describe('consumeNonce', () => {
  it('consumes an issued nonce exactly once (replay is rejected)', async () => {
    const { nonce } = await issueNonce(ctx.db);
    expect(await consumeNonce(ctx.db, nonce)).toBe(true);
    expect(await consumeNonce(ctx.db, nonce)).toBe(false);
  });

  it('rejects a nonce that was never issued', async () => {
    expect(await consumeNonce(ctx.db, 'f'.repeat(48))).toBe(false);
  });

  it('rejects a nonce once it has expired', async () => {
    const clock = createManualClock('2026-01-01T00:00:00Z');
    const { nonce } = await issueNonce(ctx.db, clock);
    clock.advance(NONCE_TTL_MS + 1_000);
    expect(await consumeNonce(ctx.db, nonce, clock)).toBe(false);
  });
});
