'use client';

import { BRAND } from '@worldrush/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { LOCALES } from '../../../lib/i18n/locale';
import { LANGUAGE_NAMES } from '../../../lib/i18n/messages';
import { useTranslation } from '../../../lib/i18n/provider';
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
  const { t, locale, automatic, setLocale } = useTranslation();
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
      setError(t('settings.signOutFailed'));
      setSigningOut(false);
    }
  }, [router, t]);

  if (!settings) return <div className="screen" />;

  return (
    <div className="screen">
      <div className="page">
        <div className="title-row">
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.strapline')}</p>
        </div>

        <div className="section-label">{t('settings.language')}</div>
        <div className="set-group notch">
          <div className="set-row">
            <div>
              <div className="t">{t('settings.language')}</div>
              <div className="d">{t('settings.languageDetail')}</div>
            </div>
            <div className="lang-picker">
              {/* AUTO is not a language: it hands the choice back to the phone's own setting, which is what
                  World's guidelines say to follow. It is listed first because it is the default. */}
              <button
                type="button"
                className={automatic ? 'lang on notch' : 'lang notch'}
                aria-pressed={automatic}
                onClick={() => setLocale(null)}
              >
                {t('settings.languageAuto')}
              </button>
              {LOCALES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={!automatic && locale === option ? 'lang on notch' : 'lang notch'}
                  aria-pressed={!automatic && locale === option}
                  onClick={() => setLocale(option)}
                >
                  {LANGUAGE_NAMES[option]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="section-label">{t('settings.sound')}</div>
        <div className="set-group notch">
          <Toggle
            label={t('settings.soundEffects')}
            detail={t('settings.soundEffectsDetail')}
            checked={settings.soundEffects}
            onChange={(next) => update('soundEffects', next)}
          />
          <Toggle
            label={t('settings.music')}
            checked={settings.music}
            onChange={(next) => update('music', next)}
          />
        </div>

        <div className="section-label">{t('settings.controls')}</div>
        <div className="set-group notch">
          <Toggle
            label={t('settings.vibration')}
            detail={t('settings.vibrationDetail')}
            checked={settings.vibration}
            onChange={(next) => update('vibration', next)}
          />
          <Toggle
            label={t('settings.swapSides')}
            detail={t('settings.swapSidesDetail')}
            checked={settings.swapSides}
            onChange={(next) => update('swapSides', next)}
          />
        </div>

        {/* The sound and control settings above are this device's and work signed out, so the screen is
            reachable either way — but it must not claim an account that is not there. */}
        <div className="section-label">{t('settings.account')}</div>
        <div className="set-group notch">
          {session?.authenticated ? (
            <>
              <div className="set-row">
                <div>
                  {/* World's guidelines: show the username, never the wallet address. */}
                  <div className="t">{session.username ?? t('settings.signedIn')}</div>
                  <div className="d">
                    {session.humanVerified
                      ? t('settings.verifiedHuman')
                      : t('settings.notVerified')}
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
                  <div className="t">{t('settings.signOut')}</div>
                  <div className="d">{t('settings.signOutDetail')}</div>
                </div>
                <button
                  className="btn btn-secondary notch set-action"
                  type="button"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                >
                  {signingOut ? t('settings.signingOut') : t('settings.signOutAction')}
                </button>
              </div>
            </>
          ) : (
            <div className="set-row">
              <div>
                <div className="t">{t('settings.notSignedIn')}</div>
                <div className="d">{t('settings.notSignedInDetail')}</div>
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

        <div className="section-label">{t('settings.about')}</div>
        <div className="set-group notch">
          <div className="set-row">
            <div>
              <div className="t">{BRAND.name}</div>
              <div className="d">{t('settings.version', { version: '0.1.0' })}</div>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="settings" />
    </div>
  );
}
