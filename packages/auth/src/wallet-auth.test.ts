import { createTestDb } from '@worldrush/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { issueNonce } from './nonce';
import { verifyWalletAuthCompletion, WalletAuthError, WORLD_CHAIN_ID } from './wallet-auth';

/**
 * Builds a real, correctly-formed EIP-4361 (SIWE) message and signs it with a throwaway EOA key (viem),
 * then hands it to the REAL `verifySiweMessage` from the installed `@worldcoin/minikit-js` package — not a
 * mock. This is the strongest check available without a phone: if the message format assumed here (or the
 * package's parsing of it) is wrong, this test fails now instead of on a real device weeks from now.
 */
async function buildSiweCompletion(opts: {
  nonce: string;
  domain: string;
  uri: string;
  chainId: number;
}): Promise<{ address: string; message: string; signature: string }> {
  const account = privateKeyToAccount(generatePrivateKey());
  const message = [
    `${opts.domain} wants you to sign in with your Ethereum account:`,
    account.address,
    '',
    'Sign in to RUSH 7.',
    '',
    `URI: ${opts.uri}`,
    'Version: 1',
    `Chain ID: ${opts.chainId}`,
    `Nonce: ${opts.nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');
  const signature = await account.signMessage({ message });
  return { address: account.address, message, signature };
}

let ctx: Awaited<ReturnType<typeof createTestDb>>;
const ORIGIN = 'https://rush7.example.com';

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

describe('verifyWalletAuthCompletion (against the real verifySiweMessage)', () => {
  it('accepts a correctly formed, correctly signed completion', async () => {
    const { nonce } = await issueNonce(ctx.db);
    const completion = await buildSiweCompletion({
      nonce,
      domain: 'rush7.example.com',
      uri: ORIGIN,
      chainId: WORLD_CHAIN_ID,
    });
    const outcome = await verifyWalletAuthCompletion(
      ctx.db,
      { ...completion, nonce },
      { expectedOrigin: ORIGIN },
    );
    expect(outcome.walletAddress).toBe(completion.address.toLowerCase());
  });

  it('rejects a replayed nonce', async () => {
    const { nonce } = await issueNonce(ctx.db);
    const completion = await buildSiweCompletion({
      nonce,
      domain: 'rush7.example.com',
      uri: ORIGIN,
      chainId: WORLD_CHAIN_ID,
    });
    await verifyWalletAuthCompletion(ctx.db, { ...completion, nonce }, { expectedOrigin: ORIGIN });
    await expect(
      verifyWalletAuthCompletion(ctx.db, { ...completion, nonce }, { expectedOrigin: ORIGIN }),
    ).rejects.toThrow(WalletAuthError);
  });

  it('rejects a message signed for a different domain (the hardening this codebase adds)', async () => {
    const { nonce } = await issueNonce(ctx.db);
    const completion = await buildSiweCompletion({
      nonce,
      domain: 'evil.example.com',
      uri: 'https://evil.example.com',
      chainId: WORLD_CHAIN_ID,
    });
    await expect(
      verifyWalletAuthCompletion(ctx.db, { ...completion, nonce }, { expectedOrigin: ORIGIN }),
    ).rejects.toThrow(WalletAuthError);
  });

  it('rejects a message signed for a chain other than World Chain', async () => {
    const { nonce } = await issueNonce(ctx.db);
    const completion = await buildSiweCompletion({
      nonce,
      domain: 'rush7.example.com',
      uri: ORIGIN,
      chainId: 1, // Ethereum mainnet, not World Chain
    });
    await expect(
      verifyWalletAuthCompletion(ctx.db, { ...completion, nonce }, { expectedOrigin: ORIGIN }),
    ).rejects.toThrow(WalletAuthError);
  });

  it('rejects a tampered signature', async () => {
    const { nonce } = await issueNonce(ctx.db);
    const completion = await buildSiweCompletion({
      nonce,
      domain: 'rush7.example.com',
      uri: ORIGIN,
      chainId: WORLD_CHAIN_ID,
    });
    const lastChar = completion.signature.slice(-1);
    const tampered = {
      ...completion,
      signature: completion.signature.slice(0, -1) + (lastChar === 'a' ? 'b' : 'a'),
    };
    await expect(
      verifyWalletAuthCompletion(ctx.db, { ...tampered, nonce }, { expectedOrigin: ORIGIN }),
    ).rejects.toThrow(WalletAuthError);
  });

  it('rejects a malformed payload before touching the database', async () => {
    await expect(
      verifyWalletAuthCompletion(
        ctx.db,
        { nonce: 'short', address: 'not-an-address' },
        { expectedOrigin: ORIGIN },
      ),
    ).rejects.toThrow(WalletAuthError);
  });
});
