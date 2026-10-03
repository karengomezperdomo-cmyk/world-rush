import { and, bestScores, eq, inArray, sql, type Db } from '@worldrush/db';
import { dayKeyUtc, mapForDay, weekStartUtc, type CompetitionRow } from './competition';
import { competitionIsOver, weekCompetitions } from './finalize';

/**
 * A week as seven days, for the leaderboard's day switcher.
 *
 * The seven days always exist here, whether or not anybody played them: the rotation is fixed in
 * `game-core`, so a day with no competition row is a day nobody has started a run on yet, not a gap. Saying
 * "Wednesday · Emerald Woods · nobody finished" is a fact; omitting Wednesday would look like a bug.
 *
 * Nothing in this file creates a competition. Reading a board must never write one — see `findCompetition`.
 */

export type DayStatus = 'upcoming' | 'live' | 'final';

export interface DayBoard {
  /** Midnight UTC of the day this board belongs to. */
  readonly day: Date;
  readonly mapNumber: number;
  readonly mapSlug: string;
  readonly status: DayStatus;
  /** Null until somebody starts a run on that day. */
  readonly competitionId: string | null;
  readonly players: number;
  readonly winnerTimeMs: number | null;
}

/** The seven midnights (UTC) of the week containing `at`, Monday first. */
export function weekDays(at: Date): Date[] {
  const monday = weekStartUtc(at);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + index);
    return day;
  });
}

function statusOf(day: Date, competition: CompetitionRow | undefined, now: Date): DayStatus {
  if (competition) {
    if (competition.status === 'finalized') return 'final';
    return competitionIsOver(competition, now) ? 'final' : 'live';
  }
  // No row: the day's state is whatever the calendar says, since nothing was raced.
  const closes = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  if (now < day) return 'upcoming';
  return now >= closes ? 'final' : 'live';
}

/**
 * The week containing `at`, with each finished day frozen first.
 *
 * Player counts come from one grouped query rather than one per day: seven round trips to render a row of
 * seven tabs would be a strange thing to build on purpose.
 */
export async function weekBoards(db: Db, at: Date, now = new Date()): Promise<DayBoard[]> {
  const competitions = await weekCompetitions(db, at, now);
  const byDay = new Map(competitions.map((row) => [dayKeyUtc(row.day).getTime(), row]));

  const ids = competitions.map((row) => row.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const rows = await db
      .select({
        competitionId: bestScores.competitionId,
        players: sql<number>`count(*)::int`,
      })
      .from(bestScores)
      // Only visible scores, exactly as the board itself counts them: a hidden score must not inflate a tab.
      .where(and(inArray(bestScores.competitionId, ids), eq(bestScores.isVisible, true)))
      .groupBy(bestScores.competitionId);
    for (const row of rows) counts.set(row.competitionId, row.players);
  }

  return weekDays(at).map((day) => {
    const competition = byDay.get(day.getTime());
    const map = mapForDay(day);
    return {
      day,
      mapNumber: map.number,
      mapSlug: map.level.id,
      status: statusOf(day, competition, now),
      competitionId: competition?.id ?? null,
      // A finalized competition already counted its players; a live one is counted now.
      players: competition
        ? (competition.participantsCount ?? counts.get(competition.id) ?? 0)
        : 0,
      winnerTimeMs: competition?.winnerTimeMs ?? null,
    };
  });
}

/** Visible player count for one competition, for a live board whose total has not been frozen yet. */
export async function playerCount(db: Db, competitionId: string): Promise<number> {
  const rows = await db
    .select({ players: sql<number>`count(*)::int` })
    .from(bestScores)
    .where(and(eq(bestScores.competitionId, competitionId), eq(bestScores.isVisible, true)));
  return rows[0]?.players ?? 0;
}
