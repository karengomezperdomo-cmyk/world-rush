import { createTestDb } from '@worldrush/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { upsertUserByWallet } from './user';

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

describe('upsertUserByWallet', () => {
  it('creates a new user with a lowercase wallet address', async () => {
    const mixedCase = `0x${'A1b2'.repeat(10)}`;
    const user = await upsertUserByWallet(ctx.db, mixedCase);
    expect(user.walletAddress).toBe(mixedCase.toLowerCase());
    expect(user.humanVerifiedAt).toBeNull();
  });

  it('returns the SAME account on a second login from the same address, whatever the casing', async () => {
    const address = `0x${'b2c3'.repeat(10)}`;
    const first = await upsertUserByWallet(ctx.db, address);
    const second = await upsertUserByWallet(ctx.db, address.toUpperCase().replace('0X', '0x'));
    expect(second.id).toBe(first.id);
  });
});
