'use client';

import { mapByNumber } from '@worldrush/game-core';
import { useCallback, useEffect, useState } from 'react';
import { avatarFor } from '../../../lib/avatar';
import { mapNameKey } from '../../../lib/i18n/map-text';
import type { MessageKey } from '../../../lib/i18n/messages';
import { useTranslation } from '../../../lib/i18n/provider';
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

const DAY_LABELS = [
  'day.mon',
  'day.tue',
  'day.wed',
  'day.thu',
  'day.fri',
  'day.sat',
  'day.sun',
] as const satisfies readonly MessageKey[];
const DAY_NAMES = [
  'dayName.mon',
  'dayName.tue',
  'dayName.wed',
  'dayName.thu',
  'dayName.fri',
  'dayName.sat',
  'dayName.sun',
] as const satisfies readonly MessageKey[];

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
 * Keyed to the UI's locale, not the device's. It used to be pinned to en-US, because every word around the
 * number was English and a Spanish phone rendered "3.421 RACERS" — which reads as three-point-four in that
 * sentence. Now that the sentence itself is Spanish, "3.421 PILOTOS" is simply how Spanish writes it, and
 * the number and the words change together, as that note said they would.
 */
function formatCount(value: number, locale: string): string {
  return value.toLocaleString(locale);
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
  const { t } = useTranslation();
  return (
    <div className={`pod p${place} notch`}>
      {place === 1 ? <Icon name="crown" className="i crown" /> : <i className="medal">{place}</i>}
      <Avatar name={entry.username} size={place === 1 ? 48 : 36} />
      <div className="nm">{entry.username ?? t('common.rider')}</div>
      <div className="tm">{formatRunTime(entry.timeMs * TICKS_PER_MS)}</div>
      {entry.humanVerified && <HumanBadge />}
    </div>
  );
}

/**
 * The board's shape while it is being fetched.
 *
 * It replaces the word "Loading…", which told the player nothing and moved the whole screen down when the
 * real rows arrived. These boxes are the sizes of the things that are coming — the day picker, the podium,
 * six rows — so the layout is already settled when the data lands. Nothing here is invented data: empty
 * frames, never a placeholder name or a made-up time.
 */
function BoardSkeleton() {
  return (
    <div aria-busy="true">
      <div className="day-picker">
        {Array.from({ length: 7 }, (_, index) => (
          <div className="dp notch skeleton" key={index} style={{ height: 40 }} />
        ))}
      </div>
      <div className="podium" style={{ paddingTop: 28 }}>
        <div className="pod p2 notch skeleton" />
        <div className="pod p1 notch skeleton" />
        <div className="pod p3 notch skeleton" />
      </div>
      <div className="lb notch">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="lb-row" key={index}>
            <span className="rk skeleton" style={{ height: 20 }} />
            <span className="skeleton" style={{ width: 28, height: 28 }} />
            <span className="nm skeleton" style={{ height: 16 }} />
            <span className="tmc skeleton" style={{ width: 86, height: 20 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Leaderboard() {
  const { t, plural, locale } = useTranslation();
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
          <h1>{t('leaderboard.title')}</h1>
          <p>
            {board
              ? `${t('home.map', { number: board.mapNumber })} · ${map ? t(mapNameKey(map)) : ''} · ${t(DAY_NAMES[weekdayIndex(board.day)]!)}`
              : t('leaderboard.thisWeek')}
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
                  aria-label={`${t(DAY_NAMES[weekdayIndex(tab.day)]!)}, ${t('home.map', { number: tab.mapNumber })}`}
                  onClick={() => setDay(tab.day)}
                >
                  {t(DAY_LABELS[weekdayIndex(tab.day)]!)}
                  {tab.status === 'upcoming' ? (
                    <Icon name="lock" className="i" />
                  ) : (
                    <small>
                      {tab.status === 'live' ? t('leaderboard.liveShort') : t('leaderboard.final')}
                    </small>
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
                  {t('leaderboard.final')}
                </span>
                <span>{t('leaderboard.noLongerChanges')}</span>
              </>
            ) : (
              <>
                <span className="live">
                  <i />
                  {t('leaderboard.live')}
                </span>
                {isToday && (
                  <span>
                    {t('leaderboard.freezesIn')} <b style={{ color: 'var(--text)' }}>{endsIn}</b>
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
              <h3>{t('leaderboard.loadFailed')}</h3>
              <p>{t('leaderboard.loadFailedDetail')}</p>
              <button
                className="btn btn-secondary notch"
                type="button"
                style={{ marginTop: 10 }}
                onClick={() => void load(day)}
              >
                {t('common.tryAgain')}
              </button>
            </div>
          </div>
        )}

        {!board && !failed && <BoardSkeleton />}

        {board && board.entries.length === 0 && (
          <div className="card notch">
            <div className="ico notch">
              <Icon name="flag" />
            </div>
            <div>
              <h3>
                {board.status === 'final'
                  ? t('leaderboard.nobodyFinished')
                  : t('leaderboard.nobodyYet')}
              </h3>
              <p>
                {board.status === 'final'
                  ? t('leaderboard.nobodyFinishedDetail')
                  : t('leaderboard.nobodyYetDetail')}
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
                      {entry.username ?? t('common.rider')}
                      {entry.humanVerified && <HumanBadge />}
                      {entry.isYou && <span className="you-tag">{t('leaderboard.you')}</span>}
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
              {plural(board.totalPlayers, 'leaderboard.racers', {
                count: formatCount(board.totalPlayers, locale),
              })}
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
                {t('leaderboard.you')}
                <span className="you-tag">{t('leaderboard.you')}</span>
              </span>
              <span className="tmc">
                <div className="tm">{formatRunTime(board.you.timeMs * TICKS_PER_MS)}</div>
                {board.you.behindMs !== null && (
                  <div className="gap">
                    {t('leaderboard.behind', {
                      gap: (board.you.behindMs / 1000).toFixed(3),
                      rank: board.you.rank - 1,
                    })}
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
