import { upsertUserByWallet, verifyWalletAuthCompletion, WalletAuthError } from '@worldrush/auth';
import { getDb } from '../../../../lib/db';
import { getServerConfig } from '../../../../lib/server-env';
import { startSession } from '../../../../lib/session-cookie';

export const dynamic = 'force-dynamic';

/**
 * Completes `MiniKit.walletAuth()`: the client posts back `result.data` plus the nonce it was given. Any
 * rejection reason (bad shape, reused/expired nonce, bad signature, wrong domain/uri/chainId) becomes the
 * same generic 401 — never tell an attacker which check failed.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const db = await getDb();
  const { appOrigin } = getServerConfig();
  try {
    const { walletAddress } = await verifyWalletAuthCompletion(db, body, {
      expectedOrigin: appOrigin,
    });
    const user = await upsertUserByWallet(db, walletAddress);
    await startSession(user.id);
    return Response.json({
      walletAddress: user.walletAddress,
      username: user.username,
      humanVerified: user.humanVerifiedAt !== null,
    });
  } catch (error) {
    if (error instanceof WalletAuthError) {
      console.warn('[auth/complete] rejected:', error.message);
      return Response.json({ error: 'sign-in could not be verified' }, { status: 401 });
    }
    throw error;
  }
}
