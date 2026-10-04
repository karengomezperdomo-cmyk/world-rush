import { competitions, eq, type Db } from '@worldrush/db';
import { levelFingerprint, mapByNumber, type MapEntry } from '@worldrush/game-core';

/**
 * Competitions: one map, open for one day.
 *
 * ## The ruleset
 *
 * A replay is only meaningful against the physics it was recorded with. Retuning the bike changes every
 * stored time just as surely as moving a ramp does, and nothing in the level data would show it — so each
 * competition records which ruleset it ran under, and a submission recorded under a different one is
 * rejected rather than quietly re-simulated to a different answer.
 *
 * Bump this whenever the simulation changes in a way that alters outcomes. `determinism.test.ts` is the
 * alarm: if it fails, this needs bumping and the old competitions keep their old value.
 */
// r2 (2026-10-03): the bike has a fuel tank. A replay recorded under r1 could hold more than a tankful of
// throttle, which would now re-simulate differently - the engine dies partway - so r1 replays are not
// comparable and competitions opened under r1 keep their own value.
export const CURRENT_RULESET = 'r2';

/** Midnight UTC of the day containing `at`. The cut-over hour is decision A3: UTC. */
export function dayKeyUtc(at: Date): Date {
  const day = new Date(at);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

/** The Monday of the week containing `at`, in UTC — how seven competitions are grouped into a week. */
export function weekStartUtc(at: Date): Date {
  const monday = dayKeyUtc(at);
  const weekday = monday.getUTCDay() === 0 ? 7 : monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (weekday - 1));
  return monday;
}

/** Which map a given UTC day runs. Map 1 on Monday through map 7 on Sunday. */
export function mapForDay(at: Date): MapEntry {
  const weekday = dayKeyUtc(at).getUTCDay();
  const map = mapByNumber(weekday === 0 ? 7 : weekday);
  if (!map) throw new Error(`no map for weekday ${weekday}`);
  return map;
}

/**
 * A competition row, taken from the schema rather than restated here.
 *
 * It used to be a hand-written subset, which is how `participantsCount`, `winnerTimeMs` and `finalizedAt`
 * came to be invisible to everything that reads a competition even though the table has always had them.
 * Deriving it means a column added to the table is a column this package can see, and one removed from it
 * fails to compile here instead of at runtime.
 */
export type CompetitionRow = typeof competitions.$inferSelect;

/**
 * The competition for a given day, created on first use.
 *
 * Phase 8 schedules these properly ahead of time. Creating on demand is enough for Phase 7 and has one real
 * advantage: a competition is stamped with the fingerprint and ruleset that were live when it opened, rather
 * than with whatever a scheduler guessed days earlier.
 *
 * The insert tolerates a race. Two players finishing their first run of the day at the same moment both find
 * no competition and both try to create one; the unique index on `day` means one wins and the other re-reads
 * the winner's row, instead of a duplicate or an error surfacing to a player.
 */
export async function competitionForDay(db: Db, at: Date): Promise<CompetitionRow> {
  const day = dayKeyUtc(at);
  const existing = await db.select().from(competitions).where(eq(competitions.day, day)).limit(1);
  if (existing[0]) return existing[0] as CompetitionRow;

  const map = mapForDay(day);
  const closesAt = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  const inserted = await db
    .insert(competitions)
    .values({
      mapSlug: map.level.id,
      levelFingerprint: levelFingerprint(map.level),
      ruleset: CURRENT_RULESET,
      day,
      weekStart: weekStartUtc(day),
      opensAt: day,
      closesAt,
      status: 'open',
    })
    .onConflictDoNothing({ target: competitions.day })
    .returning();
  if (inserted[0]) return inserted[0] as CompetitionRow;

  // Lost the race: the other writer's row is the one that counts.
  const winner = await db.select().from(competitions).where(eq(competitions.day, day)).limit(1);
  if (!winner[0]) throw new Error('competition disappeared after a conflicting insert');
  return winner[0] as CompetitionRow;
}

/** Whether a run started at `startedAt` may still be submitted to this competition at `now`. */
export function submissionWindowOpen(
  competition: Pick<CompetitionRow, 'opensAt' | 'closesAt' | 'graceSeconds'>,
  startedAt: Date,
  now: Date,
): boolean {
  if (startedAt < competition.opensAt) return false;
  if (startedAt > competition.closesAt) return false;
  // Grace applies to runs ALREADY under way: finishing at 23:59:58 must not be unrankable through no fault
  // of the player. It does not let anyone start a new run after the close.
  const deadline = new Date(competition.closesAt.getTime() + competition.graceSeconds * 1000);
  return now <= deadline;
}

/** The competition a map slug belongs to for a day, used to reject a replay aimed at the wrong map. */
export function competitionMatchesMap(competition: CompetitionRow, map: MapEntry): boolean {
  return (
    competition.mapSlug === map.level.id &&
    competition.levelFingerprint === levelFingerprint(map.level) &&
    competition.ruleset === CURRENT_RULESET
  );
}
