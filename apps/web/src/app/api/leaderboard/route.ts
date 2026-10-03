import { competitionForReading, mapForDay, playerCount, readLeaderboard, weekBoards } from '@worldrush/runs';
import { getDb } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/session-cookie';

export const dynamic = 'force-dynamic';

/**
 * A day's leaderboard, and the week it belongs to.
 *
 * `?day=YYYY-MM-DD` reads a past day; without it, today. Both go through `competitionForReading`, which
 * freezes a finished board before returning it and — unlike `competitionForDay` — **never creates one**.
 * That distinction matters here: this endpoint is public, so a path that created rows on demand would let
 * anyone fill the table with competitions for days nobody ever played by walking the calendar backwards.
 *
 * Readable without signing in — a board nobody can look at is not much of a board — but the viewer's own
 * standing is only included when there is a session to attach it to.
 *
 * User ids are deliberately not returned. The board needs a name and a time; handing out internal ids to
 * anyone who asks would let a caller enumerate the players.
 */
export async function GET(request: Request): Promise<Response> {
  const requested = new URL(request.url).searchParams.get('day');
  const day = requested === null ? new Date() : parseDay(requested);
  if (day === null) {
    return Response.json({ error: 'day must be YYYY-MM-DD' }, { status: 400 });
  }

  const session = await getCurrentSession();
  const db = await getDb();
  const now = new Date();
  const competition = await competitionForReading(db, day, now);
  const map = mapForDay(day);

  // No competition means nobody has started a run that day: a real, empty board rather than a 404.
  if (!competition) {
    return Response.json({
      day: dayKey(day),
      mapNumber: map.number,
      mapSlug: map.level.id,
      // No row, so the day's state is whatever the calendar says: nothing was raced to finalize.
      status: dayStatusFromCalendar(day, now),
      closesAt: null,
      finalizedAt: null,
      totalPlayers: 0,
      you: null,
      entries: [],
      week: await weekTabs(db, day, now),
    });
  }

  const board = await readLeaderboard(db, competition.id, { viewerId: session?.userId });

  return Response.json({
    day: dayKey(day),
    mapNumber: map.number,
    mapSlug: competition.mapSlug,
    status: competition.status === 'finalized' ? 'final' : 'live',
    closesAt: competition.closesAt,
    finalizedAt: competition.finalizedAt,
    // A frozen board reports the count it froze; a live one is counted now.
    totalPlayers: competition.participantsCount ?? (await playerCount(db, competition.id)),
    you: board.you,
    entries: board.entries.map((entry) => ({
      rank: entry.rank,
      // World's guidelines: show the username, never the wallet address.
      username: entry.username,
      humanVerified: entry.humanVerified,
      timeMs: entry.timeMs,
      isYou: entry.isYou,
    })),
    week: await weekTabs(db, day, now),
  });
}

/**
 * The week's seven days, with each day as `YYYY-MM-DD`.
 *
 * The key the client sends back is the key it was given, and it carries no time of day: a timestamp would
 * mean the browser had to decide which day `2026-10-03T00:00:00Z` falls on in its own timezone, and in
 * Colombia that is the 2nd.
 */
async function weekTabs(db: Awaited<ReturnType<typeof getDb>>, day: Date, now: Date) {
  const week = await weekBoards(db, day, now);
  return week.map((entry) => ({ ...entry, day: dayKey(entry.day) }));
}

/**
 * The state of a day nobody ever started a run on.
 *
 * A past day with no competition is FINAL and empty — the race happened, nobody rode it. Calling it "live"
 * would invite a player to set a time on a day that ended last week.
 */
function dayStatusFromCalendar(day: Date, now: Date): 'upcoming' | 'live' | 'final' {
  if (now < day) return 'upcoming';
  return now.getTime() >= day.getTime() + 24 * 60 * 60 * 1000 ? 'final' : 'live';
}

/** `YYYY-MM-DD` as midnight UTC, or null. Rejects anything that is not exactly that shape. */
function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // `new Date('2026-02-31T…')` rolls over to March rather than failing, which would silently answer about a
  // different day than the one asked for.
  return dayKey(parsed) === value ? parsed : null;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
