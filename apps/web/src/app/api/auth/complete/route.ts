import { upsertUserByWallet, verifyWalletAuthCompletion, WalletAuthError } from '@worldrush/auth';
import { getDb } from '../../../../lib/db';
import { readJsonBody, SMALL_JSON_BYTES } from '../../../../lib/json-body';
import { getServerConfig } from '../../../../lib/server-env';
import { startSession } from '../../../../lib/session-cookie';
import { sameOriginViolation } from '../../../../lib/same-origin';

export const dynamic = 'force-dynamic';

/**
 * Completes `MiniKit.walletAuth()`: the client posts back `result.data` plus the nonce it was given. Any
 * rejection reason (bad shape, reused/expired nonce, bad signature, wrong domain/uri/chainId) becomes the
 * same generic 401 — never tell an attacker which check failed.
 */
export async function POST(request: Request): Promise<Response> {
  const refused = sameOriginViolation(request);
  if (refused) return refused;

  const read = await readJsonBody(request, SMALL_JSON_BYTES);
  if (read.tooLarge) return read.response;
  if (read.value === undefined) {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const body = read.value;

  const db = await getDb();
  const { appOrigin } = getServerConfig();
  try {
    const { walletAddress } = await verifyWalletAuthCompletion(db, body, {
      expectedOrigin: appOrigin,
    });
    const user = await upsertUserByWallet(db, walletAddress);
    await startSession(user.id);
    // Same as `/api/auth/session`: no wallet address goes to the browser. The session cookie is what proves
    // who this is from here on, and the screens show usernames.
    return Response.json({
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
