'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { avatarFor } from '../../lib/avatar';
import { dayKey, dayNameKey, mapNameKey, mapTaglineKey } from '../../lib/i18n/map-text';
import { useTranslation } from '../../lib/i18n/provider';
import {
  formatCountdown,
  millisecondsUntilNextRace,
  todaysMap,
  weekRangeLabel,
  weekSchedule,
  type ScheduledMap,
} from '../../lib/schedule';
import { Icon } from './IconSprite';
import { TabBar } from './TabBar';

/**
 * The Home screen from `design/screens/home.html`, wired to the real maps and the real clock.
 *
 * The markup deliberately keeps the mock's class names so the copied `ui.css` styles it unchanged; what the
 * mock hard-coded (MONDAY, MAP 1, a frozen 12:47:32 clock, seven literal tiles) now comes from `MAPS` and
 * `lib/schedule`. The fake status bar and home indicator are gone: World App draws those.
 *
 * Two things are deliberately NOT here, because they are not decided or not built:
 * - the week number ("WEEK 1" in the mock) needs decision A3's start date, so the header shows a date range;
 * - the leaderboard needs Phase 7, so its button and tab are visibly disabled rather than linking nowhere.
 */

export interface HomeSession {
  username?: string | null;
  humanVerified?: boolean;
}

/** Map thumbnails are copied to `public/art/thumbs` by `scripts/copy-art.mjs`. */
function thumbnailFor(mapId: string, mapNumber: number): string {
  return `/art/thumbs/map-${mapNumber}-${mapId}.png`;
}

/**
 * Every map now has its own painted hero scene at 175x183 (`tools/art/heroes.mjs`), so the art under the
 * day's name is always that day's map. Until those existed only Sunset Canyon had one, and the alternatives
 * were both bad: reusing the canyon scene put canyon art under the words "CORAL COAST", and stretching a
 * 46x28 thumbnail across a 350px hero turned it to mush at a 12x non-integer upscale.
 *
 * The art slug and the level id are the same string by design, so no lookup table is needed.
 */
function heroSceneFor(mapId: string): string {
  return `/art/scenes/hero-${mapId}.png`;
}

function DayTile({ scheduled }: { scheduled: ScheduledMap }) {
  const { t } = useTranslation();
  const { map, status } = scheduled;
  const className =
    status === 'today'
      ? 'tile today notch'
      : status === 'locked'
        ? 'tile locked notch'
        : status === 'past'
          ? 'tile closed notch'
          : 'tile notch';
  const label = t(
    status === 'today'
      ? 'home.today'
      : status === 'locked'
        ? 'home.locked'
        : status === 'past'
          ? 'home.closed'
          : 'home.open',
  );

  const tile = (
    <div className={className}>
      <div className="d">{t(dayKey(map.day))}</div>
      <div className="th">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, served as-is: Next's optimiser resamples it */}
        <img className="pix" src={thumbnailFor(map.level.id, map.number)} alt="" />
        {status === 'locked' && (
          <div className="lock">
            <i>
              <Icon name="lock" />
            </i>
          </div>
        )}
      </div>
      <div className="n">{t('home.map', { number: map.number })}</div>
      <div className="s">{label}</div>
    </div>
  );

  // Today's map needs no query string; the rest carry one only while every map is open for testing.
  if (status === 'locked' || status === 'past') return tile;
  return (
    <Link
      className="tile-link"
      href={status === 'today' ? '/play' : `/play?map=${map.number}`}
      aria-label={t('home.playMapAria', { number: map.number, name: t(mapNameKey(map)) })}
    >
      {tile}
    </Link>
  );
}

/**
 * What the screen looks like for the one frame before the clock exists.
 *
 * Everything on Home depends on the date — which map is today's, which days are closed, how long is left —
 * and the date has to come from the player's own device after mount: a server-rendered "now" is already
 * stale when it lands on the phone, and would not match on hydration. That left a blank screen on every
 * open, which reads as a slow app.
 *
 * So the layout is drawn first and the contents arrive a frame later. The boxes are the real sizes, so
 * nothing moves when the data appears; what they are NOT is fake data. An empty frame that fills in is
 * honest; a placeholder map name would be a guess shown as a fact.
 */
function HomeSkeleton() {
  return (
    <div className="screen" aria-busy="true">
      <header className="appbar">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
        <img className="logo pix" src="/art/logo/rush7.png" alt="RUSH 7" />
        <div className="user-chip notch skeleton" />
      </header>
      <section className="hero notch skeleton" style={{ height: 300 }} />
      <section className="week-head">
        <div className="skeleton" style={{ width: 140, height: 34 }} />
        <div className="trophy-chip notch skeleton" style={{ width: 120 }} />
      </section>
      <section className="days">
        {Array.from({ length: 7 }, (_, index) => (
          <div className="tile notch skeleton" key={index} style={{ height: 112 }} />
        ))}
      </section>
      <TabBar active="home" />
    </div>
  );
}

export function Home({ session }: { session: HomeSession }) {
  const { t, locale } = useTranslation();
  // Rendered on the client from a clock that starts at mount: a server-rendered "now" would be wrong by the
  // time it reached the phone, and would not match on hydration.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return <HomeSkeleton />;

  const today = todaysMap(now);
  const week = weekSchedule(now);
  // World's Mini App guidelines say to "Display usernames instead of wallet addresses", so a missing
  // username falls back to a neutral word rather than to 0x7f49 — which is the address, just shortened.
  const displayName = session.username ?? t('common.rider');

  return (
    <div className="screen">
      <header className="appbar">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
        <img className="logo pix" src="/art/logo/rush7.png" alt="RUSH 7" />
        <div className="user-chip notch">
          {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
          <img className="avatar pix" src={avatarFor(session.username)} alt="" />
          <span className="user-name">{displayName}</span>
          {session.humanVerified && (
            // PLACEHOLDER: World's review guidelines require their official "human" badge asset next to
            // usernames. This pill stands in for it and must be replaced unmodified, not restyled.
            <span className="human notch">
              <Icon name="ring" />
              human
            </span>
          )}
          <Icon name="chevron" className="i" />
        </div>
      </header>

      <section className="hero notch glow">
        <div className="art">
          {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
          <img className="pix" src={heroSceneFor(today.level.id)} alt="" />
          <div className="hero-copy">
            <div className="kicker">{t('home.todaysRace')}</div>
            <div className="day">
              <Icon name="calendar" />
              {t(dayNameKey(today.day))}
            </div>
            <div className="map-no">{t('home.map', { number: today.number })}</div>
            <div className="map-name">{t(mapNameKey(today))}</div>
            <p className="blurb">{t(mapTaglineKey(today))}</p>
          </div>
          <div className="clock notch">
            <Icon name="clock" />
            <div>
              <div className="l">{t('home.raceEndsIn')}</div>
              <div className="t">{formatCountdown(millisecondsUntilNextRace(now))}</div>
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/play">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <use href="#play" />
            </svg>
            {t('home.playNow')}
          </Link>
          <Link className="btn btn-secondary notch" href="/leaderboard">
            <Icon name="bars" className="i" />
            {t('home.viewLeaderboard')}
          </Link>
        </div>
      </section>

      <section className="week-head">
        <div>
          <h2>{t('home.thisWeek')}</h2>
          <div className="dates">{weekRangeLabel(now, locale)}</div>
        </div>
        <div className="trophy-chip notch">
          <Icon name="trophy" />
          <div>
            {t('home.sevenMapsSevenDays')}
            <br />
            {/* The mock said "1 CHAMPION". There is no weekly title (A5 parked), so it says what there is. */}
            <b>{t('home.sevenLeaderboards')}</b>
          </div>
        </div>
      </section>

      <section className="days">
        {week.map((scheduled) => (
          <DayTile key={scheduled.map.number} scheduled={scheduled} />
        ))}
      </section>

      <TabBar active="home" />
    </div>
  );
}
