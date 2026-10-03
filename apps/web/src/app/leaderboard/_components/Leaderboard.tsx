'use client';

import { mapByNumber } from '@worldrush/game-core';
import { useCallback, useEffect, useState } from 'react';
import { avatarFor } from '../../../lib/avatar';
import { formatCountdown, millisecondsUntilNextRace } from '../../../lib/schedule';
import { formatRunTime } from '../../../lib/run-time';
import { Icon } from '../../_components/IconSprite';
import { TabBar } from '../../_components/TabBar';

/**
 * The week's seven boards, following `design/screens/leaderboard.html`: the day picker, the live row, a
 * podium for the top three and the list under it. Markup keeps the mock's class names so the copied
 * `screens.css` styles it unchanged.
 *
 * Three things depart from the mock, each because the mock would be saying something untrue:
 *
 * - The mock locks every day except today. Here a PAST day is openable — it has a board, and seven boards a
 *   week is the whole shape of the game. Only days that have not started are locked.
 * - The mock puts a "human" badge on every row. It is drawn per player from World ID, because ranking does
 *   not require verification yet (decision A2 chose that it should; it is not enforced), so a badge on every
 *   line would be a claim about people the server has not checked.
 * - The avatars are a fixed set picked from the player's name, not their World profile picture, which
 *   nothing fetches yet. They are decoration, which is why the same name always gets the same one.
 */

interface Entry {
  rank: number;
  username: string | null;
  humanVerified: boolean;
  timeMs: number;
  isYou: boolean;
}

interface DayTab {
  day: string;
  mapNumber: number;
  mapSlug: string;
  status: 'upcoming' | 'live' | 'final';
  players: number;
  winnerTimeMs: number | null;
}

interface Board {
  day: string;
  mapNumber: number;
  mapSlug: string;
  status: 'upcoming' | 'live' | 'final';
  finalizedAt: string | null;
  totalPlayers: number;
  you: { rank: number; timeMs: number; behindMs: number | null } | null;
  entries: Entry[];
  week: DayTab[];
}

/** Times arrive in milliseconds; `formatRunTime` works in simulation ticks. */
const TICKS_PER_MS = 60 / 1000;

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const DAY_NAMES = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

/** `YYYY-MM-DD` of the UTC day — the same key the API takes, so no timezone maths travels in a URL. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday, from a `YYYY-MM-DD` key, in UTC. */
function weekdayIndex(day: string): number {
  const utcDay = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
}

/**
 * Counts, grouped the way the screen's own language groups them.
 *
 * Pinned to en-US rather than the device's locale: every word around the number is English, so a phone set
 * to Spanish would otherwise render "3.421 RACERS", which reads as three point four in the sentence it sits
 * in. When Spanish arrives (A6) the number and the words change together, not separately.
 */
function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** A gap in seconds, as the mock writes it: `+0.633`. */
function formatGap(milliseconds: number): string {
  return `+${(milliseconds / 1000).toFixed(3)}`;
}

function HumanBadge() {
  // PLACEHOLDER: World's review guidelines require their official "human" badge asset next to usernames.
  // This pill stands in for it and must be replaced unmodified, not restyled.
  return (
    <span className="human notch">
      <Icon name="ring" className="i" />
      human
    </span>
  );
}

function Avatar({ name, size }: { name: string | null; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled
    <img
      className="avatar pix"
      src={avatarFor(name)}
      alt=""
      style={size === undefined ? undefined : { width: size, height: size }}
    />
  );
}

function Podium({ entries }: { entries: Entry[] }) {
  const [first, second, third] = entries;
  if (!first) return null;
  // The mock's order is 2 · 1 · 3, so the winner stands in the middle and taller.
  return (
    <div className="podium" style={{ paddingTop: 28 }}>
      {second ? <PodiumPlace entry={second} place={2} /> : <div />}
      <PodiumPlace entry={first} place={1} />
      {third ? <PodiumPlace entry={third} place={3} /> : <div />}
    </div>
  );
}

function PodiumPlace({ entry, place }: { entry: Entry; place: 1 | 2 | 3 }) {
  return (
    <div className={`pod p${place} notch`}>
      {place === 1 ? <Icon name="crown" className="i crown" /> : <i className="medal">{place}</i>}
      <Avatar name={entry.username} size={place === 1 ? 48 : 36} />
      <div className="nm">{entry.username ?? 'RIDER'}</div>
      <div className="tm">{formatRunTime(entry.timeMs * TICKS_PER_MS)}</div>
      {entry.humanVerified && <HumanBadge />}
    </div>
  );
}

export function Leaderboard() {
  const [day, setDay] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const [endsIn, setEndsIn] = useState('');

  const load = useCallback(async (requested: string | null) => {
    setFailed(false);
    try {
      const url = requested === null ? '/api/leaderboard' : `/api/leaderboard?day=${requested}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      setBoard((await response.json()) as Board);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load(day);
  }, [day, load]);

  // Only the day that is actually being raced has a deadline worth counting down.
  const isToday = board?.day === dayKey(new Date());
  useEffect(() => {
    if (board?.status !== 'live' || !isToday) return;
    const update = () => setEndsIn(formatCountdown(millisecondsUntilNextRace(new Date())));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [board?.status, isToday]);

  const map = board ? mapByNumber(board.mapNumber) : undefined;
  const leaderMs = board?.entries[0]?.timeMs ?? null;
  const rest = board?.entries.slice(3) ?? [];

  return (
    <div className="screen">
      <div className="page">
        <div className="title-row">
          <h1>LEADERBOARD</h1>
          <p>
            {board
              ? `MAP ${board.mapNumber} · ${map?.name.toUpperCase() ?? ''} · ${DAY_NAMES[weekdayIndex(board.day)]}`
              : 'THIS WEEK'}
          </p>
        </div>

        {board && (
          <div className="day-picker">
            {board.week.map((tab) => {
              const selected = tab.day === board.day;
              return (
                <button
                  key={tab.day}
                  type="button"
                  className={`dp notch${selected ? ' on' : ''}${tab.status === 'upcoming' ? ' locked' : ''}`}
                  // A day that has not started has no board to look at yet, so it is shown but not offered.
                  disabled={tab.status === 'upcoming'}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`${DAY_NAMES[weekdayIndex(tab.day)]}, map ${tab.mapNumber}`}
                  onClick={() => setDay(tab.day)}
                >
                  {DAY_LABELS[weekdayIndex(tab.day)]}
                  {tab.status === 'upcoming' ? (
                    <Icon name="lock" className="i" />
                  ) : (
                    <small>{tab.status === 'live' ? 'LIVE' : 'FINAL'}</small>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {board && (
          <div className="live-row">
            {board.status === 'final' ? (
              <>
                <span className="live frozen">
                  <i />
                  FINAL
                </span>
                <span>THIS BOARD NO LONGER CHANGES</span>
              </>
            ) : (
              <>
                <span className="live">
                  <i />
                  LIVE
                </span>
                {isToday && (
                  <span>
                    FREEZES IN <b style={{ color: 'var(--text)' }}>{endsIn}</b>
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {failed && (
          <div className="card notch" role="alert">
            <div className="ico notch">
              <Icon name="alert" />
            </div>
            <div>
              <h3>COULD NOT LOAD THE BOARD</h3>
              <p>Check your connection and try again.</p>
              <button
                className="btn btn-secondary notch"
                type="button"
                style={{ marginTop: 10 }}
                onClick={() => void load(day)}
              >
                TRY AGAIN
              </button>
            </div>
          </div>
        )}

        {!board && !failed && <p className="lb-empty">Loading…</p>}

        {board && board.entries.length === 0 && (
          <div className="card notch">
            <div className="ico notch">
              <Icon name="flag" />
            </div>
            <div>
              <h3>{board.status === 'final' ? 'NOBODY FINISHED' : 'NOBODY HAS FINISHED YET'}</h3>
              <p>
                {board.status === 'final'
                  ? 'No verified time was set on this map before the day ended.'
                  : 'No verified time has been set on this map. The first one could be yours.'}
              </p>
            </div>
          </div>
        )}

        {board && board.entries.length > 0 && (
          <>
            <Podium entries={board.entries} />

            {rest.length > 0 && (
              <div className="lb notch">
                {rest.map((entry) => (
                  <div
                    className={entry.isYou ? 'lb-row me' : 'lb-row'}
                    key={`${entry.rank}-${entry.username ?? ''}`}
                  >
                    <span className="rk">{entry.rank}</span>
                    <Avatar name={entry.username} />
                    {/* World's guidelines: usernames, never wallet addresses. */}
                    <span className="nm">
                      {entry.username ?? 'RIDER'}
                      {entry.humanVerified && <HumanBadge />}
                      {entry.isYou && <span className="you-tag">YOU</span>}
                    </span>
                    <span className="tmc">
                      <div className="tm">{formatRunTime(entry.timeMs * TICKS_PER_MS)}</div>
                      {leaderMs !== null && entry.timeMs > leaderMs && (
                        <div className="gap">{formatGap(entry.timeMs - leaderMs)}</div>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="foot-note">
              {formatCount(board.totalPlayers)} {board.totalPlayers === 1 ? 'RACER' : 'RACERS'} ·
              ONE BEST TIME EACH
            </div>
          </>
        )}

        {/* Shown when the player is ranked below the visible page, so they always know where they stand. */}
        {board?.you && !board.entries.some((entry) => entry.isYou) && (
          <div className="lb pinned notch" style={{ margin: 0 }}>
            <div className="lb-row me">
              <span className="rk">{board.you.rank}</span>
              <Avatar name={null} />
              <span className="nm">
                YOU<span className="you-tag">YOU</span>
              </span>
              <span className="tmc">
                <div className="tm">{formatRunTime(board.you.timeMs * TICKS_PER_MS)}</div>
                {board.you.behindMs !== null && (
                  <div className="gap">
                    {(board.you.behindMs / 1000).toFixed(3)} BEHIND #{board.you.rank - 1}
                  </div>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      <TabBar active="leaderboard" />
    </div>
  );
}
