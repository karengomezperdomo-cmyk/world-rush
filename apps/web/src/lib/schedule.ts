import { MAPS, type MapEntry } from '@worldrush/game-core';

/**
 * Which map is open today, and what the rest of the week looks like.
 *
 * This lives in the app and not in `game-core` on purpose: the simulation package bans host clocks outright
 * (its determinism lint rejects `Date` along with `Math.random` and friends), because a replay that asked the
 * machine what time it was could not be re-simulated to the same result on the server.
 *
 * **Decision A3 is still open**, and it is not being invented here. Two things depend on it:
 *
 * - *The cut-over hour.* Midnight UTC is used below because it is the recommendation already recorded in
 *   `docs/DECISIONS.md` §5, and something has to be used to render a screen. It is a default in force, not a
 *   decision taken on the owner's behalf — one constant changes it.
 * - *The week numbering.* "WEEK 1" needs an agreed start date for week 1, which nobody has chosen, so the
 *   Home screen shows the current week's date range and no number. Counting weeks from an invented epoch
 *   would look authoritative while being fiction.
 */

/** The hour (UTC) at which the day's map changes. Provisional — see A3. */
export const DAILY_CUT_OVER_HOUR_UTC = 0;

export type DayStatus = 'past' | 'today' | 'locked';

export interface ScheduledMap {
  readonly map: MapEntry;
  readonly status: DayStatus;
}

/**
 * Day of the week as 1 = Monday ... 7 = Sunday, in UTC, respecting the cut-over hour.
 * `Date#getUTCDay` returns 0 for Sunday, which would put Sunday's map first.
 */
export function raceDayOfWeek(now: Date): number {
  const shifted = new Date(now.getTime() - DAILY_CUT_OVER_HOUR_UTC * 60 * 60 * 1000);
  const day = shifted.getUTCDay();
  return day === 0 ? 7 : day;
}

/** The map open right now. Map 1 opens on Monday, map 7 on Sunday. */
export function todaysMap(now: Date): MapEntry {
  const dayOfWeek = raceDayOfWeek(now);
  const map = MAPS.find((entry) => entry.number === dayOfWeek);
  // MAPS is proven to hold exactly maps 1-7 in `maps.test.ts`, so this cannot miss.
  if (!map) throw new Error(`no map for day ${dayOfWeek}`);
  return map;
}

/** All seven maps with the day's map marked, earlier days closed and later days still locked. */
export function weekSchedule(now: Date): ScheduledMap[] {
  const today = raceDayOfWeek(now);
  return MAPS.map((map) => ({
    map,
    status: map.number < today ? 'past' : map.number === today ? 'today' : 'locked',
  }));
}

/** Milliseconds until the day's map is replaced by the next one. */
export function millisecondsUntilNextRace(now: Date): number {
  const next = new Date(now);
  next.setUTCHours(DAILY_CUT_OVER_HOUR_UTC, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

/** `HH:MM:SS`, counting down. Clamped at zero rather than rendering a negative clock. */
export function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

/**
 * The Monday-to-Sunday range containing `now`, as `SEP 15 – SEP 21`, for the Home screen's week header.
 * Deliberately a date range and not "WEEK 1": see the note about A3 above.
 */
export function weekRangeLabel(now: Date): string {
  const dayOfWeek = raceDayOfWeek(now);
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - (dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const format = (date: Date) =>
    `${date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()} ${date.getUTCDate()}`;
  return `${format(monday)} – ${format(sunday)}`;
}
