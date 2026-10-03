'use client';

import { useCallback, useEffect, useState } from 'react';
import { Home } from './Home';
import { SignIn } from './SignIn';

interface SessionState {
  authenticated: boolean;
  userId?: string;
  username?: string | null;
  humanVerified?: boolean;
}

/**
 * Decides what the app's entry route shows: the sign-in flow, or the game's Home screen.
 *
 * There are THREE states here, not two, and collapsing them is a real bug rather than a nicety: while the
 * session is still being fetched we do not know whether the player is signed in, and rendering the sign-in
 * screen in the meantime tells them they are signed out when they are not. Reported from a phone
 * (2026-09-29) as "going to the main menu sends me back to logging in" — the menu did appear, but only after
 * the request came back, and on a phone that gap is long enough to read as a redirect. Quitting a run back
 * to `/` made it happen every single time.
 *
 * A failed request is its own state too. Silently falling back to the sign-in screen would tell the player
 * to sign in again when the truth is that the app could not reach its own API.
 *
 * `SignIn` keeps its own copy of the session because it drives the World App wallet-auth and World ID
 * handshakes from it; it reports back through `onSession` so this shell can swap to Home the moment the
 * handshake completes, instead of leaving the player looking at a stale sign-in button.
 */

type Status = 'loading' | 'ready' | 'unreachable';

export function AppShell({ worldIdAppId }: { worldIdAppId?: `app_${string}` }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!response.ok) throw new Error(`session request failed: ${response.status}`);
      setSession((await response.json()) as SessionState);
      setStatus('ready');
    } catch {
      setStatus('unreachable');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSession = useCallback((next: SessionState) => {
    setSession(next);
    setStatus('ready');
  }, []);

  if (status === 'loading') {
    return (
      <main className="shell boot" aria-busy="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
        <img className="logo pix" src="/art/logo/rush7.png" alt="RUSH 7" />
        <p className="boot-note">LOADING…</p>
      </main>
    );
  }

  if (status === 'unreachable') {
    return (
      <main className="shell boot">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
        <img className="logo pix" src="/art/logo/rush7.png" alt="RUSH 7" />
        <p className="boot-note" role="alert">
          Could not reach the game. Check your connection.
        </p>
        <button className="btn btn-secondary notch" type="button" onClick={() => void load()}>
          TRY AGAIN
        </button>
      </main>
    );
  }

  if (session?.authenticated) return <Home session={session} />;

  return (
    <main className="shell">
      <h1>RUSH 7</h1>
      <SignIn worldIdAppId={worldIdAppId} onSession={onSession} />
    </main>
  );
}
