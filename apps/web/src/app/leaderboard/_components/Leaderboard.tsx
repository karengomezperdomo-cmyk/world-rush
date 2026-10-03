'use client';

import { mapByNumber } from '@worldrush/game-core';
import { useCallback, useEffect, useState } from 'react';
import { formatCountdown, millisecondsUntilNextRace } from '../../../lib/schedule';
import { formatRunTime } from '../../../lib/run-time';
import { Icon } from '../../_components/IconSprite';
import { TabBar } from '../../_components/TabBar';

/**
 * The seven boards of the week, one tab per day.
 *
 * Every time here was computed by the server from the inputs the player pressed, not reported by their
 * device — which is what makes a board worth looking at. Ties go to whoever got there first.
 *
 * The week is shown in full, including days nobody played and days still to come, because that is the shape
 * of the game the owner chose: seven separate boards, and missing one costs nothing. A screen that only ever
 * showed today would quietly imply the opposite — that a day you skipped is simply gone.
 *
 * A day that has ended says FINAL and never changes again; the server freezes it on the first read after its
 * grace period, so "final" here means the ranks are written down, not merely that the clock has passed.
 */

interface Entry {
  rank: number;
  username: string | null;
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
  you: { rank: number; timeMs: number } | null;
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

function medalClass(rank: number, isYou: boolean): string {
  const medal = rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : '';
  return `lb-row${medal}${isYou ? ' me' : ''}`;
}

/** `YYYY-MM-DD` of the UTC day — the same key the API takes, so no timezone maths travels in a URL. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday, from a `YYYY-MM-DD` key, in UTC. */
function weekdayIndex(day: string): number {
  const utcDay = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
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
  useEffect(() => {
    if (board?.status !== 'live' || board.day !== dayKey(new Date())) return;
    const update = () => setEndsIn(formatCountdown(millisecondsUntilNextRace(new Date())));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [board?.status, board?.day]);

  const map = board ? mapByNumber(board.mapNumber) : undefined;
  const riders = `${board?.totalPlayers.toLocaleString() ?? '0'} ${board?.totalPlayers === 1 ? 'RIDER' : 'RIDERS'}`;

  return (
    <div className="screen">
      <div className="page">
        <div className="title-row">
          <h1>LEADERBOARD</h1>
          <p>
            {board
              ? `${DAY_NAMES[weekdayIndex(board.day)]} · MAP ${board.mapNumber} · ${map?.name.toUpperCase() ?? ''}`
              : 'THIS WEEK'}
          </p>
        </div>

        {board && (
          <div className="lb-days">
            {board.week.map((tab) => {
              const selected = tab.day === board.day;
              const className = `lb-day notch${selected ? ' on' : ''}${tab.status === 'upcoming' ? ' ahead' : ''}`;
              return (
                <button
                  key={tab.day}
                  type="button"
                  className={className}
                  // A day that has not started has no board to look at yet, so it is shown but not offered.
                  disabled={tab.status === 'upcoming'}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => setDay(tab.day)}
                >
                  <span className="d">{DAY_LABELS[weekdayIndex(tab.day)]}</span>
                  <span className="m">{tab.mapNumber}</span>
                </button>
              );
            })}
          </div>
        )}

        {board && (
          <div className="lb-state notch">
            {board.status === 'final' ? (
              <>
                <Icon name="check" />
                FINAL · {riders}
              </>
            ) : board.day === dayKey(new Date()) ? (
              <>
                <Icon name="clock" />
                LIVE · {riders} · ENDS IN {endsIn}
              </>
            ) : (
              <>
                <Icon name="clock" />
                LIVE · {riders}
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
          <div className="lb notch">
            {board.entries.map((entry) => (
              <div className={medalClass(entry.rank, entry.isYou)} key={`${entry.rank}-${entry.username ?? ''}`}>
                <span className="rk">{entry.rank}</span>
                {/* World's guidelines: usernames, never wallet addresses. */}
                <span className="nm">
                  {entry.username ?? 'RIDER'}
                  {entry.isYou && <span className="you-tag">YOU</span>}
                </span>
                <span className="tmc">
                  <span className="tm">{formatRunTime(entry.timeMs * TICKS_PER_MS)}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Shown when the player is ranked below the visible page, so they always know where they stand. */}
        {board?.you && !board.entries.some((entry) => entry.isYou) && (
          <div className="lb-row pinned notch">
            <span className="rk">{board.you.rank}</span>
            <span className="nm">
              YOU<span className="you-tag">YOU</span>
            </span>
            <span className="tmc">
              <span className="tm">{formatRunTime(board.you.timeMs * TICKS_PER_MS)}</span>
            </span>
          </div>
        )}
      </div>

      <TabBar active="leaderboard" />
    </div>
  );
}
