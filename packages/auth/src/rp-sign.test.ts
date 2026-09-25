import { describe, expect, it } from 'vitest';
import { signWorldIdRequest } from './rp-sign';

// A throwaway 32-byte hex key, the format `signRequest` actually requires (confirmed empirically against
// @worldcoin/idkit-core@4.3.0: it throws "expected 32 bytes (64 hex chars)" for anything else). Never a real
// Developer Portal signing key — those do not exist yet (decision D1).
const FAKE_SIGNING_KEY = 'ab'.repeat(32);

describe('signWorldIdRequest', () => {
  it('returns an RpContext with the rp_id supplied by the caller and a signature from idkit-core', () => {
    const context = signWorldIdRequest('rp_test_123', FAKE_SIGNING_KEY, 'verify-human');
    expect(context.rp_id).toBe('rp_test_123');
    expect(context.signature).toMatch(/^0x[0-9a-f]+$/);
    expect(context.nonce).toMatch(/^0x[0-9a-f]+$/);
    expect(context.created_at).toBeLessThanOrEqual(context.expires_at);
    // Unix seconds, not milliseconds: within a wide sane range around "now".
    expect(context.created_at).toBeGreaterThan(1_700_000_000);
    expect(context.created_at).toBeLessThan(4_000_000_000);
  });

  it('signs a different nonce for every call', () => {
    const a = signWorldIdRequest('rp_test_123', FAKE_SIGNING_KEY, 'verify-human');
    const b = signWorldIdRequest('rp_test_123', FAKE_SIGNING_KEY, 'verify-human');
    expect(a.nonce).not.toBe(b.nonce);
  });

  it('rejects a malformed signing key instead of silently producing garbage', () => {
    expect(() => signWorldIdRequest('rp_test_123', 'not-hex', 'verify-human')).toThrow();
  });
});
