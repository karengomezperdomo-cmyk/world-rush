import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  assertDatabaseEnvironment,
  authNonces,
  createLocalDb,
  DatabaseEnvironmentError,
  markDatabaseEnvironment,
  PG_CHECK_VIOLATION,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
  sessions,
  systemMeta,
  users,
  worldIdVerifications,
} from './index';
import { createTestDb } from './testing';

async function sqlstateOf(promise: PromiseLike<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return pgErrorCode(error);
  }
}

const UNIQUE_VIOLATION = PG_UNIQUE_VIOLATION;
const CHECK_VIOLATION = PG_CHECK_VIOLATION;

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;

/** Creates a user with a unique lowercase wallet address. */
async function newUser(): Promise<{ id: string; walletAddress: string }> {
  counter += 1;
  const walletAddress = `0x${counter.toString(16).padStart(40, '0')}`;
  const [row] = await ctx.db.insert(users).values({ walletAddress }).returning();
  if (!row) throw new Error('insert returned no row');
  return { id: row.id, walletAddress };
}

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

describe('environment guard (staging code can never open production data)', () => {
  it('passes when the database marker matches APP_ENV', async () => {
    await expect(assertDatabaseEnvironment(ctx.db, 'development')).resolves.toBeUndefined();
  });

  it('refuses to start against a database from another environment', async () => {
    await expect(assertDatabaseEnvironment(ctx.db, 'production')).rejects.toThrow(
      DatabaseEnvironmentError,
    );
    await expect(assertDatabaseEnvironment(ctx.db, 'staging')).rejects.toThrow(
      /marked as "development"/,
    );
  });

  it('refuses a database that was never marked', async () => {
    const fresh = await createLocalDb();
    try {
      await applyMigrations(fresh.db);
      await expect(assertDatabaseEnvironment(fresh.db, 'development')).rejects.toThrow(
        /no environment marker/,
      );
    } finally {
      await fresh.close();
    }
  });

  it('marking is idempotent and can never relabel an existing database', async () => {
    await expect(markDatabaseEnvironment(ctx.db, 'development')).resolves.toBeUndefined();
    await expect(markDatabaseEnvironment(ctx.db, 'production')).rejects.toThrow(
      DatabaseEnvironmentError,
    );
    const rows = await ctx.db.select().from(systemMeta);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.environment).toBe('development');
  });

  it('system_meta is a singleton with a valid environment', async () => {
    expect(
      await sqlstateOf(ctx.db.insert(systemMeta).values({ id: false, environment: 'staging' })),
    ).toBe(CHECK_VIOLATION);
    expect(await sqlstateOf(ctx.db.update(systemMeta).set({ environment: 'prod' }))).toBe(
      CHECK_VIOLATION,
    );
  });
});

describe('users', () => {
  it('applies defaults', async () => {
    const [row] = await ctx.db
      .insert(users)
      .values({ walletAddress: `0x${'a'.repeat(40)}` })
      .returning();
    expect(row?.status).toBe('active');
    expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.humanVerifiedAt).toBeNull();
  });

  it.each([
    ['uppercase hex', `0x${'A'.repeat(40)}`],
    ['too short', `0x${'a'.repeat(39)}`],
    ['no 0x prefix', 'a'.repeat(42)],
    ['non-hex', `0x${'g'.repeat(40)}`],
  ])('rejects a malformed wallet address (%s)', async (_label, walletAddress) => {
    expect(await sqlstateOf(ctx.db.insert(users).values({ walletAddress }))).toBe(CHECK_VIOLATION);
  });

  it('enforces one account per wallet address', async () => {
    const wallet = `0x${'b'.repeat(40)}`;
    await ctx.db.insert(users).values({ walletAddress: wallet });
    expect(await sqlstateOf(ctx.db.insert(users).values({ walletAddress: wallet }))).toBe(
      UNIQUE_VIOLATION,
    );
  });

  it('rejects an unknown status', async () => {
    expect(
      await sqlstateOf(
        ctx.db.insert(users).values({ walletAddress: `0x${'c'.repeat(40)}`, status: 'vip' }),
      ),
    ).toBe(CHECK_VIOLATION);
  });
});

describe('auth nonces (single use)', () => {
  const consume = (nonce: string) =>
    ctx.db
      .update(authNonces)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(authNonces.nonce, nonce),
          isNull(authNonces.consumedAt),
          gt(authNonces.expiresAt, sql`now()`),
        ),
      )
      .returning({ nonce: authNonces.nonce });

  it('only alphanumeric nonces of 16-64 characters are accepted (SIWE requires alphanumeric)', async () => {
    const future = new Date(Date.now() + 60_000);
    for (const bad of ['short', 'has-hyphens-in-it-0000000000', 'x'.repeat(65)]) {
      expect(
        await sqlstateOf(ctx.db.insert(authNonces).values({ nonce: bad, expiresAt: future })),
      ).toBe(CHECK_VIOLATION);
    }
  });

  it('can be consumed exactly once', async () => {
    const nonce = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    await ctx.db.insert(authNonces).values({ nonce, expiresAt: new Date(Date.now() + 60_000) });
    expect(await consume(nonce)).toHaveLength(1);
    expect(await consume(nonce)).toHaveLength(0); // replay -> rejected
  });

  it('cannot be consumed after it expires', async () => {
    const nonce = 'ffeeddccbbaa99887766554433221100';
    await ctx.db.insert(authNonces).values({ nonce, expiresAt: new Date(Date.now() - 1000) });
    expect(await consume(nonce)).toHaveLength(0);
  });
});

describe('sessions', () => {
  const future = () => new Date(Date.now() + 86_400_000);

  it('stores only a token hash and keeps it unique', async () => {
    const user = await newUser();
    const tokenHash = new Uint8Array(32).fill(7);
    await ctx.db
      .insert(sessions)
      .values({ userId: user.id, tokenHash, expiresAt: future(), absoluteExpiresAt: future() });
    const other = await newUser();
    expect(
      await sqlstateOf(
        ctx.db.insert(sessions).values({
          userId: other.id,
          tokenHash,
          expiresAt: future(),
          absoluteExpiresAt: future(),
        }),
      ),
    ).toBe(UNIQUE_VIOLATION);
  });

  it('round-trips the hash bytes exactly', async () => {
    const user = await newUser();
    const tokenHash = Uint8Array.from({ length: 32 }, (_, i) => i * 8);
    await ctx.db
      .insert(sessions)
      .values({ userId: user.id, tokenHash, expiresAt: future(), absoluteExpiresAt: future() });
    const [row] = await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(Array.from(row?.tokenHash ?? [])).toEqual(Array.from(tokenHash));
  });

  it('is deleted together with its user', async () => {
    const user = await newUser();
    await ctx.db.insert(sessions).values({
      userId: user.id,
      tokenHash: new Uint8Array(32).fill(9),
      expiresAt: future(),
      absoluteExpiresAt: future(),
    });
    await ctx.db.delete(users).where(eq(users.id, user.id));
    expect(await ctx.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(
      0,
    );
  });
});

describe('world_id_verifications (one human, one account)', () => {
  const MAX_256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
  const base = { protocolVersion: '4.0', credential: 'proof_of_human', environment: 'production' };

  it('stores a 256-bit nullifier exactly (numeric, never a JS number)', async () => {
    const user = await newUser();
    await ctx.db
      .insert(worldIdVerifications)
      .values({ ...base, userId: user.id, action: 'test-max', nullifier: MAX_256 });
    const [row] = await ctx.db
      .select()
      .from(worldIdVerifications)
      .where(eq(worldIdVerifications.userId, user.id));
    expect(row?.nullifier).toBe(MAX_256);
  });

  it('the same human cannot bind a second account for the same action', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await ctx.db
      .insert(worldIdVerifications)
      .values({ ...base, userId: a.id, action: 'test-unique', nullifier: '12345' });
    expect(
      await sqlstateOf(
        ctx.db
          .insert(worldIdVerifications)
          .values({ ...base, userId: b.id, action: 'test-unique', nullifier: '12345' }),
      ),
    ).toBe(UNIQUE_VIOLATION);
  });

  it('one account cannot hold two nullifiers for the same action', async () => {
    const user = await newUser();
    await ctx.db
      .insert(worldIdVerifications)
      .values({ ...base, userId: user.id, action: 'test-once', nullifier: '1' });
    expect(
      await sqlstateOf(
        ctx.db
          .insert(worldIdVerifications)
          .values({ ...base, userId: user.id, action: 'test-once', nullifier: '2' }),
      ),
    ).toBe(UNIQUE_VIOLATION);
  });

  it('the same nullifier value is allowed under a different action', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await ctx.db
      .insert(worldIdVerifications)
      .values({ ...base, userId: a.id, action: 'season-1', nullifier: '777' });
    await expect(
      ctx.db
        .insert(worldIdVerifications)
        .values({ ...base, userId: b.id, action: 'season-2', nullifier: '777' }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['protocol version', { protocolVersion: '5.0' }],
    ['environment', { environment: 'dev' }],
    ['negative nullifier', { nullifier: '-1' }],
  ])('rejects an invalid %s', async (_label, override) => {
    const user = await newUser();
    expect(
      await sqlstateOf(
        ctx.db.insert(worldIdVerifications).values({
          ...base,
          userId: user.id,
          action: `test-bad-${counter}`,
          nullifier: '42',
          ...override,
        }),
      ),
    ).toBe(CHECK_VIOLATION);
  });
});
