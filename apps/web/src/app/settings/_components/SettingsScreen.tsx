'use client';

import { BRAND } from '@worldrush/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { readSettings, writeSetting, type Settings } from '../../../lib/settings';
import { Icon } from '../../_components/IconSprite';
import { TabBar } from '../../_components/TabBar';

/**
 * Settings, from `design/screens/settings.html`.
 *
 * **Every switch here changes something that exists.** The mock also shows a control-layout A/B segment,
 * "reduce flashing" and "anonymous usage stats"; those are left out on purpose, because scheme B is not
 * built, nothing flashes yet, and there is no analytics to opt out of. A dead switch is a small lie, and a
 * dead *privacy* switch is a large one — it tells the player they have turned off collection that was never
 * happening, and would go on lying if collection were ever added.
 *
 * Signing out is ours, not World's: it clears our session cookie. It does not, and cannot, touch the
 * player's World App account.
 */

interface SessionInfo {
  authenticated: boolean;
  username?: string | null;
  humanVerified?: boolean;
}

function Toggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="set-row">
      <div>
        <div className="t">{label}</div>
        {detail && <div className="d">{detail}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={checked ? 'toggle on notch' : 'toggle notch'}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read on the client only: `localStorage` does not exist during the server render, and reading it in the
  // first paint would make the markup disagree with itself on hydration.
  useEffect(() => {
    setSettings(readSettings());
    void (async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (response.ok) setSession((await response.json()) as SessionInfo);
      } catch {
        // The account row simply does not render; nothing here depends on it.
      }
    })();
  }, []);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(writeSetting(key, value));
  }, []);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout failed');
      router.push('/');
      router.refresh();
    } catch {
      setError('Could not sign out. Check your connection and try again.');
      setSigningOut(false);
    }
  }, [router]);

  if (!settings) return <div className="screen" />;

  return (
    <div className="screen">
      <div className="page">
        <div className="title-row">
          <h1>SETTINGS</h1>
          <p>MAKE IT FEEL RIGHT</p>
        </div>

        <div className="section-label">SOUND</div>
        <div className="set-group notch">
          <Toggle
            label="Sound effects"
            detail="Engine, checkpoints, crashes and the finish"
            checked={settings.soundEffects}
            onChange={(next) => update('soundEffects', next)}
          />
          <Toggle
            label="Music"
            checked={settings.music}
            onChange={(next) => update('music', next)}
          />
        </div>

        <div className="section-label">CONTROLS</div>
        <div className="set-group notch">
          <Toggle
            label="Vibration"
            detail="Feedback on checkpoints, crashes and the finish. Only inside World App."
            checked={settings.vibration}
            onChange={(next) => update('vibration', next)}
          />
          <Toggle
            label="Swap sides"
            detail="Gas and brake on the left"
            checked={settings.swapSides}
            onChange={(next) => update('swapSides', next)}
          />
        </div>

        {/* The sound and control settings above are this device's and work signed out, so the screen is
            reachable either way — but it must not claim an account that is not there. */}
        <div className="section-label">ACCOUNT</div>
        <div className="set-group notch">
          {session?.authenticated ? (
            <>
              <div className="set-row">
                <div>
                  {/* World's guidelines: show the username, never the wallet address. */}
                  <div className="t">{session.username ?? 'Signed in'}</div>
                  <div className="d">
                    {session.humanVerified ? 'Verified human' : 'Not verified as human yet'}
                  </div>
                </div>
                {session.humanVerified && (
                  // PLACEHOLDER: World's guidelines want their official "human" badge asset here, unmodified.
                  <span className="human notch">
                    <Icon name="ring" />
                    human
                  </span>
                )}
              </div>
              <div className="set-row">
                <div>
                  <div className="t">Sign out</div>
                  <div className="d">
                    Ends your RUSH 7 session. Your World App account is untouched.
                  </div>
                </div>
                <button
                  className="btn btn-secondary notch set-action"
                  type="button"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                >
                  {signingOut ? 'SIGNING OUT…' : 'SIGN OUT'}
                </button>
              </div>
            </>
          ) : (
            <div className="set-row">
              <div>
                <div className="t">Not signed in</div>
                <div className="d">Sign in from the home screen to record times.</div>
              </div>
            </div>
          )}
          {error && (
            <div className="set-row" role="alert">
              <div className="d" style={{ color: 'var(--red)' }}>
                {error}
              </div>
            </div>
          )}
        </div>

        <div className="section-label">ABOUT</div>
        <div className="set-group notch">
          <div className="set-row">
            <div>
              <div className="t">{BRAND.name}</div>
              <div className="d">Version 0.1.0 · provisional art and copy</div>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="settings" />
    </div>
  );
}
