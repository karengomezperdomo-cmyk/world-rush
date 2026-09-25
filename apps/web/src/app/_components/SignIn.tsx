'use client';

import { IDKitRequestWidget, proofOfHuman, type RpContext } from '@worldcoin/idkit';
import { MiniKit } from '@worldcoin/minikit-js';
import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal, functional wiring for Phase 2 (MiniKit wallet-auth + World ID). Not the styled Home screen from
 * `design/` — this exists to prove the auth plumbing end to end; the real Home UI is assembled later.
 */

const WORLD_ID_ACTION = 'verify-human';

interface SessionState {
  authenticated: boolean;
  userId?: string;
  walletAddress?: string;
  username?: string | null;
  humanVerified?: boolean;
}

export function SignIn({ worldIdAppId }: { worldIdAppId?: `app_${string}` }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);

  const refreshSession = useCallback(async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    setSession((await response.json()) as SessionState);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!MiniKit.isInstalled()) {
        setError("Open this inside World App to sign in — MiniKit isn't available here.");
        return;
      }
      const nonceResponse = await fetch('/api/auth/nonce', { method: 'POST' });
      const { nonce } = (await nonceResponse.json()) as { nonce: string };
      const result = await MiniKit.walletAuth({ nonce });
      const completeResponse = await fetch('/api/auth/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...result.data, nonce }),
      });
      if (!completeResponse.ok) throw new Error('Sign-in could not be verified.');
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSession({ authenticated: false });
  }, []);

  const startVerify = useCallback(async () => {
    setError(null);
    const response = await fetch('/api/world-id/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: WORLD_ID_ACTION }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'World ID is not configured yet.');
      return;
    }
    setRpContext((await response.json()) as RpContext);
    setVerifyOpen(true);
  }, []);

  if (!session) return <p>Loading…</p>;

  if (!session.authenticated) {
    return (
      <div className="auth-box">
        <button type="button" onClick={() => void signIn()} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in with World App'}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="auth-box">
      <p>
        Signed in as <strong>{session.username ?? session.walletAddress}</strong>
      </p>
      <p>Human verified: {session.humanVerified ? 'yes' : 'no'}</p>
      {!session.humanVerified && worldIdAppId && session.userId && (
        <>
          <button type="button" onClick={() => void startVerify()}>
            Verify you&apos;re human
          </button>
          {rpContext && (
            <IDKitRequestWidget
              open={verifyOpen}
              onOpenChange={setVerifyOpen}
              app_id={worldIdAppId}
              action={WORLD_ID_ACTION}
              rp_context={rpContext}
              allow_legacy_proofs={true}
              preset={proofOfHuman({ signal: session.userId })}
              handleVerify={async (result) => {
                const response = await fetch('/api/world-id/verify', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(result),
                });
                if (!response.ok) throw new Error('World ID verification failed.');
              }}
              onSuccess={() => {
                setVerifyOpen(false);
                void refreshSession();
              }}
              onError={(errorCode) => setError(`World ID verification failed (${errorCode}).`)}
            />
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
