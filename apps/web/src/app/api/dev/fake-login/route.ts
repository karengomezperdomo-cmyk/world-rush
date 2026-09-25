import { randomBytes } from 'node:crypto';
import { upsertUserByWallet } from '@worldrush/auth';
import { assertDevelopmentOnly } from '@worldrush/config';
import { z } from 'zod';
import { getDb } from '../../../../lib/db';
import { getServerConfig } from '../../../../lib/server-env';
import { startSession } from '../../../../lib/session-cookie';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
});

function randomWalletAddress(): string {
  return `0x${randomBytes(20).toString('hex')}`;
}

/**
 * DEV-ONLY test harness: mints a session for a fake (or supplied) wallet address, without MiniKit and
 * without a device. `assertDevelopmentOnly` throws outside development, so this always fails in staging and
 * production (packages/config/src/guards.ts). This is a TEST TOOL, not a security control, and it exists
 * because MiniKit only runs inside World App: there is otherwise no way to exercise sessions, the
 * leaderboard, or anything behind login on a normal machine before decisions D1 (Developer Portal apps) and
 * D2 (a real test device) happen.
 */
export async function POST(request: Request): Promise<Response> {
  assertDevelopmentOnly(getServerConfig().appEnv, 'the fake-login harness');

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine: we mint a random address.
  }
  const parsed = bodySchema.safeParse(body);
  const walletAddress =
    (parsed.success ? parsed.data.walletAddress : undefined) ?? randomWalletAddress();

  const db = await getDb();
  const user = await upsertUserByWallet(db, walletAddress);
  await startSession(user.id);
  return Response.json({ walletAddress: user.walletAddress, dev: true });
}
