'use client';

import { useCallback, useEffect, useState } from 'react';
import { Home } from './Home';
import { SignIn } from './SignIn';

interface SessionState {
  authenticated: boolean;
  userId?: string;
  walletAddress?: string;
  username?: string | null;
  humanVerified?: boolean;
}

/**
 * Decides what the app's entry route shows: the sign-in flow, or the game's Home screen.
 *
 * `SignIn` keeps its own copy of the session because it drives the World App wallet-auth and World ID
 * handshakes from it; it reports back through `onSession` so this shell can swap to Home the moment the
 * handshake completes, instead of leaving the player looking at a stale sign-in button.
 */
export function AppShell({ worldIdAppId }: { worldIdAppId?: `app_${string}` }) {
  const [session, setSession] = useState<SessionState | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    setSession((await response.json()) as SessionState);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (session?.authenticated) return <Home session={session} />;

  return (
    <main className="shell">
      <h1>RUSH 7</h1>
      <SignIn worldIdAppId={worldIdAppId} onSession={setSession} />
    </main>
  );
}
