import { bestScores, competitions, eq, runs, users, type Db } from '@worldrush/db';
import { createTestDb } from '@worldrush/db/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { competitionForDay } from './competition';
import {
  competitionForReading,
  finalizationDue,
  finalizeCompetition,
  finalizeDueCompetitions,
  findCompetition,
  weekCompetitions,
} from './finalize';

/**
 * Freezing a day's board.
 *
 * The property that matters here is not "the numbers are right" but "the numbers stop moving, exactly once":
 * a board is finalized whether or not a job ran, the ranks it writes are the ones the live board was already
 * showing, and finalizing twice changes nothing.
 */

let local: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;

/** A Monday, so the day's map is map 1. */
const MONDAY = new Date('2026-10-05T12:00:00Z');
/** Past Monday's close plus its 120 s grace. */
const AFTER_MONDAY = new Date('2026-10-06T00:05:00Z');

beforeEach(async () => {
  local = await createTestDb();
  db = local.db;
});

afterEach(async () => {
  await local.close();
});

let walletCounter = 0;
async function makeUser(): Promise<string> {
  walletCounter += 1;
  const wallet = `0x${walletCounter.toString(16).padStart(40, '0')}`;
  const [row] = await db.insert(users).values({ walletAddress: wallet }).returning();
  return row!.id;
}

/** Puts a verified best time on the board directly: this file is about closing boards, not about runs. */
async function putScore(competitionId: string, timeMs: number, achievedAt: Date): Promise<string> {
  const userId = await makeUser();
  const [run] = await db
    .insert(runs)
    .values({
      userId,
      competitionId,
      ruleset: 'r1',
      status: 'valid',
      startedAt: achievedAt,
      completedAt: achievedAt,
      durationMs: timeMs,
    })
    .returning();
  await db
    .insert(bestScores)
    .values({ competitionId, userId, bestTimeMs: timeMs, runId: run!.id, achievedAt });
  return userId;
}

describe('finalizing a competition', () => {
  it('writes the ranks the live board was already showing, and records the winner', async () => {
    const competition = await competitionForDay(db, MONDAY);
    const fast = await putScore(competition.id, 41_000, new Date('2026-10-05T10:00:00Z'));
    const slow = await putScore(competition.id, 55_000, new Date('2026-10-05T11:00:00Z'));
    // Same time as `fast`, set later: first come, first served, so this must rank third.
    const tied = await putScore(competition.id, 41_000, new Date('2026-10-05T13:00:00Z'));

    const finalized = await finalizeCompetition(db, competition.id, AFTER_MONDAY);
    expect(finalized.status).toBe('finalized');
    expect(finalized.participantsCount).toBe(3);
    expect(finalized.winnerTimeMs).toBe(41_000);

    const ranks = await db
      .select()
      .from(bestScores)
      .where(eq(bestScores.competitionId, competition.id));
    const rankOf = (userId: string) => ranks.find((row) => row.userId === userId)!.finalRank;
    expect(rankOf(fast)).toBe(1);
    expect(rankOf(tied)).toBe(2);
    expect(rankOf(slow)).toBe(3);
  });

  it('is idempotent: finalizing twice changes nothing', async () => {
    const competition = await competitionForDay(db, MONDAY);
    await putScore(competition.id, 41_000, new Date('2026-10-05T10:00:00Z'));

    const first = await finalizeCompetition(db, competition.id, AFTER_MONDAY);
    const second = await finalizeCompetition(db, competition.id, new Date('2026-10-07T09:00:00Z'));
    expect(second.finalizedAt).toEqual(first.finalizedAt);
    expect(second.participantsCount).toBe(1);
  });

  it('refuses to freeze a race that is still running, including during the grace period', async () => {
    const competition = await competitionForDay(db, MONDAY);
    await putScore(competition.id, 41_000, new Date('2026-10-05T10:00:00Z'));

    // Midnight has passed but the 120 s grace has not: a run started at 23:59:58 may still arrive.
    const duringGrace = new Date('2026-10-06T00:01:00Z');
    expect(finalizationDue(competition, duringGrace)).toBe(false);
    const untouched = await finalizeCompetition(db, competition.id, duringGrace);
    expect(untouched.status).not.toBe('finalized');
    expect(untouched.finalizedAt).toBeNull();
  });

  it('records a day nobody finished as what it was, rather than inventing a winner', async () => {
    const competition = await competitionForDay(db, MONDAY);
    const finalized = await finalizeCompetition(db, competition.id, AFTER_MONDAY);
    expect(finalized.participantsCount).toBe(0);
    expect(finalized.winnerTimeMs).toBeNull();
  });

  it('leaves a hidden score off the frozen ranking', async () => {
    const competition = await competitionForDay(db, MONDAY);
    const cheat = await putScore(competition.id, 10_000, new Date('2026-10-05T09:00:00Z'));
    const honest = await putScore(competition.id, 41_000, new Date('2026-10-05T10:00:00Z'));
    await db.update(bestScores).set({ isVisible: false }).where(eq(bestScores.userId, cheat));

    const finalized = await finalizeCompetition(db, competition.id, AFTER_MONDAY);
    expect(finalized.participantsCount).toBe(1);
    expect(finalized.winnerTimeMs).toBe(41_000);

    const rows = await db
      .select()
      .from(bestScores)
      .where(eq(bestScores.competitionId, competition.id));
    expect(rows.find((row) => row.userId === honest)!.finalRank).toBe(1);
    expect(rows.find((row) => row.userId === cheat)!.finalRank).toBeNull();
  });
});

describe('reading a day', () => {
  it('does not create a competition for a day that never ran', async () => {
    expect(await findCompetition(db, MONDAY)).toBeUndefined();
    expect(await competitionForReading(db, MONDAY, AFTER_MONDAY)).toBeUndefined();
    const all = await db.select().from(competitions);
    expect(all).toHaveLength(0);
  });

  it('freezes a finished day on first read, without waiting for a job', async () => {
    const competition = await competitionForDay(db, MONDAY);
    await putScore(competition.id, 41_000, new Date('2026-10-05T10:00:00Z'));

    const read = await competitionForReading(db, MONDAY, AFTER_MONDAY);
    expect(read!.status).toBe('finalized');
    expect(read!.participantsCount).toBe(1);
  });

  it('gives the week its days, oldest first, freezing the ones that are over', async () => {
    await competitionForDay(db, MONDAY);
    await competitionForDay(db, new Date('2026-10-06T12:00:00Z'));
    await competitionForDay(db, new Date('2026-10-07T12:00:00Z'));

    // Midday Wednesday: Monday and Tuesday are over, Wednesday is still being raced.
    const week = await weekCompetitions(db, MONDAY, new Date('2026-10-07T12:00:00Z'));
    expect(week.map((row) => row.mapSlug)).toHaveLength(3);
    expect(week.map((row) => row.status)).toEqual(['finalized', 'finalized', 'open']);
  });
});

describe('the cron job', () => {
  it('closes everything that is due and nothing that is not', async () => {
    await competitionForDay(db, MONDAY);
    await competitionForDay(db, new Date('2026-10-06T12:00:00Z'));

    const closed = await finalizeDueCompetitions(db, new Date('2026-10-06T12:00:00Z'));
    expect(closed).toBe(1);

    // Running it again when nothing new is due is a no-op, which is what makes a missed day harmless.
    expect(await finalizeDueCompetitions(db, new Date('2026-10-06T12:30:00Z'))).toBe(0);
  });
});
