import { users } from '@worldrush/db';
import { createTestDb } from '@worldrush/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { callVerifyEndpoint, recordWorldIdVerification, WORLD_ID_CREDENTIAL } from './world-id';

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;

async function newUser(): Promise<string> {
  counter += 1;
  const walletAddress = `0x${counter.toString(16).padStart(40, '0')}`;
  const [row] = await ctx.db.insert(users).values({ walletAddress }).returning({ id: users.id });
  if (!row) throw new Error('insert returned no row');
  return row.id;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

describe('callVerifyEndpoint', () => {
  it('posts the IDKit response verbatim to the confirmed v4 verify URL', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        success: true,
        action: 'test',
        nullifier: '42',
        created_at: '2026-01-01T00:00:00Z',
        environment: 'staging',
      }),
    );
    const result = await callVerifyEndpoint(
      'rp_abc',
      { hello: 'world' },
      fetchImpl as unknown as typeof fetch,
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://developer.world.org/api/v4/verify/rp_abc',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ hello: 'world' }) }),
    );
    expect(result).toEqual({ ok: true, nullifier: '42', action: 'test', environment: 'staging' });
  });

  it('parses an error response', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, { success: false, code: 'invalid_proof', detail: 'nope' }),
    );
    const result = await callVerifyEndpoint('rp_abc', {}, fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, code: 'invalid_proof', detail: 'nope' });
  });

  it('throws on an unrecognised response shape rather than silently accepting it', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { some: 'unexpected shape' }));
    await expect(
      callVerifyEndpoint('rp_abc', {}, fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow();
  });
});

describe('recordWorldIdVerification (one human, one account per action)', () => {
  const base = {
    action: 'test-action',
    protocolVersion: '4.0' as const,
    credential: WORLD_ID_CREDENTIAL,
    environment: 'staging' as const,
  };

  it('records a first verification and stamps human_verified_at', async () => {
    const userId = await newUser();
    const outcome = await recordWorldIdVerification(ctx.db, { ...base, userId, nullifier: '1001' });
    expect(outcome).toEqual({ status: 'recorded' });
    const [row] = await ctx.db
      .select({ at: users.humanVerifiedAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(row?.at).toBeInstanceOf(Date);
  });

  it('treats an exact replay as idempotent, not an error', async () => {
    const userId = await newUser();
    await recordWorldIdVerification(ctx.db, { ...base, userId, nullifier: '1002' });
    const outcome = await recordWorldIdVerification(ctx.db, { ...base, userId, nullifier: '1002' });
    expect(outcome).toEqual({ status: 'already-verified' });
  });

  it('rejects a nullifier already claimed by a different account', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await recordWorldIdVerification(ctx.db, { ...base, userId: a, nullifier: '1003' });
    const outcome = await recordWorldIdVerification(ctx.db, {
      ...base,
      userId: b,
      nullifier: '1003',
    });
    expect(outcome).toEqual({ status: 'nullifier-claimed-by-another-user' });
  });

  it('flags the same user re-verifying one action with a different nullifier', async () => {
    const userId = await newUser();
    await recordWorldIdVerification(ctx.db, { ...base, userId, nullifier: '1004' });
    const outcome = await recordWorldIdVerification(ctx.db, { ...base, userId, nullifier: '1005' });
    expect(outcome).toEqual({ status: 'user-already-verified-with-different-nullifier' });
  });
});
