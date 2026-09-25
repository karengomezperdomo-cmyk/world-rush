import type { Db } from '@worldrush/db';
import { verifySiweMessage } from '@worldcoin/minikit-js/siwe';
import { z } from 'zod';
import { consumeNonce } from './nonce';
import type { Clock } from '@worldrush/shared';

/**
 * World Chain's mainnet chain ID. World App wallets (including the smart-account / EIP-1271 case) sign
 * for World Chain; MiniKit's own `sendTransaction` example uses this same value
 * (docs.world.org/mini-apps/migration/minikit-v2, confirmed 2026-09-24). Rejecting any other chain id stops
 * a signature obtained for a different chain from being replayed here.
 */
export const WORLD_CHAIN_ID = 480;

/** What the World App client posts back after `MiniKit.walletAuth()` succeeds (its `result.data`). */
export const walletAuthCompletionSchema = z.object({
  nonce: z.string().regex(/^[A-Za-z0-9]{16,64}$/, 'malformed nonce'),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'malformed address'),
  message: z.string().min(1),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'malformed signature'),
});
export type WalletAuthCompletion = z.infer<typeof walletAuthCompletionSchema>;

export class WalletAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletAuthError';
  }
}

export interface VerifyWalletAuthOptions {
  /**
   * Our own origin, e.g. "https://rush7-staging.vercel.app". SIWE's `domain`/`uri` fields must point back
   * at this origin, or a signature obtained for a lookalike site could be replayed against us.
   * `verifySiweMessage` does NOT check this itself (docs/phase-0/01-world-docs-review.md §3, "Endurecimiento
   * necesario") — this is our own addition. NOT YET CONFIRMED against a real World App SIWE message
   * (nothing to test against before a Developer Portal app + device exist, decisions D1/D2); if it turns out
   * to be too strict once we can see a real message, fix the comparison here — do not delete the check.
   */
  expectedOrigin: string;
  clock?: Clock;
}

/** The only thing callers need after a successful wallet-auth completion. */
export interface WalletAuthOutcome {
  walletAddress: string;
}

/**
 * Field names here are `domain`/`uri`/`chain_id` (snake_case for `chain_id`) because that is the REAL shape
 * of `@worldcoin/minikit-js`'s own `SiweMessage` type — confirmed 2026-09-24 by reading the package's own
 * shipped `.d.ts` directly (`build/types-*.d.ts`), which turned out to differ from both the general EIP-4361
 * convention and the standalone `siwe` npm package's camelCase `SiweMessage` class. Doc pages and even a
 * first typecheck-free guess got this wrong; only the installed package's actual types settled it.
 */
function assertExpectedOrigin(
  siwe: { domain: string; uri: string; chain_id: number },
  expectedOrigin: string,
): void {
  let expected: URL;
  try {
    expected = new URL(expectedOrigin);
  } catch {
    throw new WalletAuthError(`expectedOrigin is not a valid URL: ${expectedOrigin}`);
  }
  if (siwe.domain !== expected.host) {
    throw new WalletAuthError(`SIWE domain "${siwe.domain}" does not match "${expected.host}"`);
  }
  if (!siwe.uri.startsWith(expectedOrigin)) {
    throw new WalletAuthError(`SIWE uri "${siwe.uri}" does not start with "${expectedOrigin}"`);
  }
  // `Number(...)`, not a strict `!==`: confirmed by a real failing test (2026-09-24) that `chain_id` comes
  // through as the numeric STRING "480", not the JS number the type declaration (`chain_id: number`)
  // claims — the installed package's own runtime behaviour disagrees with its own .d.ts here. `Number()`
  // handles both representations; an actually-wrong value still lands on a real digit that fails the check.
  if (Number(siwe.chain_id) !== WORLD_CHAIN_ID) {
    throw new WalletAuthError(
      `SIWE chain_id ${siwe.chain_id} is not World Chain (${WORLD_CHAIN_ID})`,
    );
  }
}

/**
 * Verifies a `walletAuth` completion end to end: validates the shape, consumes the nonce (single use),
 * checks the SIWE signature with World's own `verifySiweMessage`, and applies the domain/uri/chainId
 * hardening that function does not do itself. Throws `WalletAuthError` for every rejection reason so a
 * route handler can turn any failure into the same generic 401 without leaking which check failed.
 */
export async function verifyWalletAuthCompletion(
  db: Db,
  input: unknown,
  options: VerifyWalletAuthOptions,
): Promise<WalletAuthOutcome> {
  const parsed = walletAuthCompletionSchema.safeParse(input);
  if (!parsed.success) throw new WalletAuthError('malformed wallet-auth payload');
  const { nonce, address, message, signature } = parsed.data;

  const consumed = await consumeNonce(db, nonce, options.clock);
  if (!consumed) throw new WalletAuthError('nonce is invalid, expired or already used');

  // `verifySiweMessage` does not always resolve to `{isValid: false}` on a bad signature: when the ECDSA
  // check fails it falls back to an EIP-1271 (smart-wallet) check against a World Chain RPC, and THAT can
  // throw (network hiccup, or — confirmed by a real test — simply "not a contract"), not resolve. Any
  // failure here becomes the same WalletAuthError as every other rejection reason.
  let verification: Awaited<ReturnType<typeof verifySiweMessage>>;
  try {
    verification = await verifySiweMessage({ address, message, signature }, nonce);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new WalletAuthError(`SIWE verification threw instead of failing cleanly: ${detail}`);
  }
  if (!verification.isValid) throw new WalletAuthError('SIWE signature did not verify');

  assertExpectedOrigin(verification.siweMessageData, options.expectedOrigin);

  // `address` is typed optional on SiweMessage (it always comes from the signed message body in practice,
  // but nothing here assumes so): treat a missing one as a verification failure, not a crash.
  const parsedAddress = verification.siweMessageData.address;
  if (!parsedAddress) throw new WalletAuthError('SIWE message carried no address');
  const verifiedAddress = parsedAddress.toLowerCase();
  if (verifiedAddress !== address.toLowerCase()) {
    // Cannot happen if verifySiweMessage did its job, but the address is our user identifier: never trust
    // the client-supplied copy over the one verifySiweMessage parsed out of the signed message itself.
    throw new WalletAuthError('verified address does not match the claimed address');
  }
  return { walletAddress: verifiedAddress };
}
