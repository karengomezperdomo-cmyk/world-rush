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
  walletAddress?: string;
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
  const { map, status } = scheduled;
  const className =
    status === 'today'
      ? 'tile today notch'
      : status === 'locked'
        ? 'tile locked notch'
        : status === 'past'
          ? 'tile closed notch'
          : 'tile notch';
  const label =
    status === 'today' ? 'TODAY' : status === 'locked' ? 'LOCKED' : status === 'past' ? 'CLOSED' : 'OPEN';

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

  // Today's map needs no query string; the rest carry one only while every map is open for testing.
  if (status === 'locked' || status === 'past') return tile;
  return (
    <Link
      className="tile-link"
      href={status === 'today' ? '/play' : `/play?map=${map.number}`}
      aria-label={`Play map ${map.number}, ${map.name}`}
    >
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
  const week = weekSchedule(now);
  // World's Mini App guidelines say to "Display usernames instead of wallet addresses", so a missing
  // username falls back to a neutral word rather than to 0x7f49 — which is the address, just shortened.
  const displayName = session.username ?? 'RIDER';

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
        <div className="art">
          {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
          <img className="pix" src={heroSceneFor(today.level.id)} alt="" />
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

      <TabBar active="home" />
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
