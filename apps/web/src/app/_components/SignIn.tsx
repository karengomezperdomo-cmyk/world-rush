'use client';

import { IDKitRequestWidget, proofOfHuman, type RpContext } from '@worldcoin/idkit';
import { MiniKit } from '@worldcoin/minikit-js';
import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal, functional wiring for Phase 2 (MiniKit wallet-auth + World ID). Not the styled Home screen from
 * `design/` — this exists to prove the auth plumbing end to end; the real Home UI is assembled later.
 */

const WORLD_ID_ACTION = 'verify-human';

/**
 * Whether to offer the local sign-in that skips World App entirely.
 *
 * Gated on the SAME condition the server enforces: `/api/dev/fake-login` calls `assertDevelopmentOnly`
 * against `APP_ENV`, so checking the public mirror of that variable means the button only ever appears where
 * it would actually work. Using `NODE_ENV` instead would show it in a local production build, where the
 * route refuses and the button would simply look broken.
 *
 * MiniKit only exists inside World App, so without this there is no way to reach the game — the menu, the
 * maps, the settings — on a desktop browser at all.
 */
const DEV_LOGIN_AVAILABLE = process.env.NEXT_PUBLIC_APP_ENV === 'development';

interface SessionState {
  authenticated: boolean;
  userId?: string;
  walletAddress?: string;
  username?: string | null;
  humanVerified?: boolean;
}

export function SignIn({
  worldIdAppId,
  onSession,
}: {
  worldIdAppId?: `app_${string}`;
  /** Reports every session read upwards, so the shell can swap to Home the moment sign-in lands. */
  onSession?: (session: SessionState) => void;
}) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);

  const refreshSession = useCallback(async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    const next = (await response.json()) as SessionState;
    setSession(next);
    onSession?.(next);
  }, [onSession]);

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

  /** Local-only: mints a throwaway session, no wallet and no World ID. */
  const devSignIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/dev/fake-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('The local sign-in harness is not available.');
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Local sign-in failed.');
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
        {DEV_LOGIN_AVAILABLE && (
          <>
            <button
              className="dev-login"
              type="button"
              onClick={() => void devSignIn()}
              disabled={busy}
            >
              {busy ? 'Opening…' : 'Skip World App (local only)'}
            </button>
            <p className="dev-login-note">
              Development build. Mints a throwaway session so the game can be played without World App.
            </p>
          </>
        )}
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
