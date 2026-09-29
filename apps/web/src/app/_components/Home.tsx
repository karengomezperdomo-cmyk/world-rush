'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  formatCountdown,
  millisecondsUntilNextRace,
  todaysMap,
  weekRangeLabel,
  weekSchedule,
  type ScheduledMap,
} from '../../lib/schedule';
import { Icon } from './IconSprite';

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
  walletAddress?: string;
  humanVerified?: boolean;
}

/** Map thumbnails are copied to `public/art/thumbs` by `scripts/copy-art.mjs`. */
function thumbnailFor(mapId: string, mapNumber: number): string {
  return `/art/thumbs/map-${mapNumber}-${mapId}.png`;
}

/**
 * Only Sunset Canyon has a painted hero scene in `design/art/scenes`; the other six maps have nothing but a
 * 46x28 pixel thumbnail. Neither shortcut is acceptable on its own: reusing the canyon scene puts canyon art
 * under the words "CORAL COAST", and stretching a 46px thumbnail to fill a 350px hero turns it to mush at a
 * 12x non-integer upscale.
 *
 * So a map without a scene gets a panel in its own accent colour with its thumbnail at a clean 4x — every
 * pixel still square — which looks deliberate instead of broken, and is honest about the art that exists.
 */
const HERO_SCENES: Record<number, string> = { 1: '/art/scenes/hero-sunset-canyon.png' };

function DayTile({ scheduled }: { scheduled: ScheduledMap }) {
  const { map, status } = scheduled;
  const className = status === 'today' ? 'tile today notch' : status === 'past' ? 'tile closed notch' : 'tile locked notch';
  const label = status === 'today' ? 'TODAY' : status === 'past' ? 'CLOSED' : 'LOCKED';

  const tile = (
    <div className={className}>
      <div className="d">{map.day}</div>
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
      <div className="n">MAP {map.number}</div>
      <div className="s">{label}</div>
    </div>
  );

  if (status !== 'today') return tile;
  return (
    <Link className="tile-link" href="/play" aria-label={`Play map ${map.number}, ${map.name}`}>
      {tile}
    </Link>
  );
}

export function Home({ session }: { session: HomeSession }) {
  // Rendered on the client from a clock that starts at mount: a server-rendered "now" would be wrong by the
  // time it reached the phone, and would not match on hydration.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return <div className="screen" />;

  const today = todaysMap(now);
  const heroScene = HERO_SCENES[today.number];
  const week = weekSchedule(now);
  const displayName = session.username ?? session.walletAddress?.slice(0, 6) ?? 'RIDER';

  return (
    <div className="screen">
      <header className="appbar">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
        <img className="logo pix" src="/art/logo/rush7.png" alt="RUSH 7" />
        <div className="user-chip notch">
          {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
          <img className="avatar pix" src="/art/avatars/a3.png" alt="" />
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
        <div
          className={heroScene ? 'art' : 'art no-scene'}
          style={heroScene ? undefined : { ['--accent' as string]: today.accent }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
          <img className="pix" src={heroScene ?? thumbnailFor(today.level.id, today.number)} alt="" />
          <div className="hero-copy">
            <div className="kicker">TODAY&apos;S RACE</div>
            <div className="day">
              <Icon name="calendar" />
              {DAY_NAMES[today.day]}
            </div>
            <div className="map-no">MAP {today.number}</div>
            <div className="map-name">{today.name.toUpperCase()}</div>
            <p className="blurb">{today.tagline}</p>
          </div>
          <div className="clock notch">
            <Icon name="clock" />
            <div>
              <div className="l">RACE ENDS IN</div>
              <div className="t">{formatCountdown(millisecondsUntilNextRace(now))}</div>
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/play">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <use href="#play" />
            </svg>
            PLAY NOW
          </Link>
          {/* Phase 7 builds the leaderboard. Until then this says so instead of linking to a dead route. */}
          <button className="btn btn-secondary notch" type="button" disabled title="Coming in Phase 7">
            <Icon name="bars" className="i" />
            VIEW LEADERBOARD
          </button>
        </div>
      </section>

      <section className="week-head">
        <div>
          <h2>THIS WEEK</h2>
          <div className="dates">{weekRangeLabel(now)}</div>
        </div>
        <div className="trophy-chip notch">
          <Icon name="trophy" />
          <div>
            7 MAPS · 7 CHALLENGES
            <br />
            <b>1 CHAMPION</b>
          </div>
        </div>
      </section>

      <section className="days">
        {week.map((scheduled) => (
          <DayTile key={scheduled.map.number} scheduled={scheduled} />
        ))}
      </section>

      {/* Four tabs. REWARDS stays behind a flag until it is real (decision A7). */}
      <nav className="tabbar">
        <span className="tab on">
          <Icon name="home" />
          HOME
        </span>
        <span className="tab" aria-disabled="true" title="Coming in Phase 7">
          <Icon name="trophy" />
          LEADERBOARD
        </span>
        <span className="tab" aria-disabled="true" title="Not built yet">
          <Icon name="help" />
          HOW TO PLAY
        </span>
        <span className="tab" aria-disabled="true" title="Not built yet">
          <Icon name="gear" />
          SETTINGS
        </span>
      </nav>
    </div>
  );
}

const DAY_NAMES: Record<string, string> = {
  MON: 'MONDAY',
  TUE: 'TUESDAY',
  WED: 'WEDNESDAY',
  THU: 'THURSDAY',
  FRI: 'FRIDAY',
  SAT: 'SATURDAY',
  SUN: 'SUNDAY',
};
