import { signRequest } from '@worldcoin/idkit-core/signing';
import type { RpContext } from '@worldcoin/idkit-core';

/**
 * Signs an RP (Relying Party) request for World ID verification (docs/phase-0/01-world-docs-review.md §4,
 * step 3 of the 6-step IDKit flow). `rpId` is the World ID app's id from the Developer Portal (decision D1,
 * not created yet); `signingKeyHex` is that app's SECRET RP signing key — never sent to the client, never
 * logged. The client passes the returned `RpContext` straight into `<IDKitRequestWidget rp_context={...}>`.
 *
 * `signRequest` itself is synchronous (confirmed against the real `@worldcoin/idkit-core@4.3.0`/
 * `@worldcoin/idkit-server@1.1.1` type declarations, 2026-09-24) even though every example wraps it in an
 * async route handler — that `async` is only for reading the request body, not for this call.
 */
export function signWorldIdRequest(rpId: string, signingKeyHex: string, action: string): RpContext {
  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex, action });
  return { rp_id: rpId, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig };
}
