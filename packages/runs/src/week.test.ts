import { bestScores, runs, users, type Db } from '@worldrush/db';
import { createTestDb } from '@worldrush/db/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { competitionForDay } from './competition';
import { weekBoards, weekDays } from './week';

/**
 * The week behind the leaderboard's day switcher.
 *
 * The thing worth testing is that a week always has seven days. A day nobody has played is a real day with
 * an empty board, and the owner's rule — miss a day and nothing happens, you are simply not on that board —
 * only reads as true if the day is still shown.
 */

let local: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;

const MONDAY = new Date('2026-10-05T12:00:00Z');
const WEDNESDAY = new Date('2026-10-07T12:00:00Z');

beforeEach(async () => {
  local = await createTestDb();
  db = local.db;
});

afterEach(async () => {
  await local.close();
});

let walletCounter = 0;
async function putScore(competitionId: string, timeMs: number, achievedAt: Date): Promise<void> {
  walletCounter += 1;
  const [user] = await db
    .insert(users)
    .values({ walletAddress: `0x${walletCounter.toString(16).padStart(40, '0')}` })
    .returning();
  const [run] = await db
    .insert(runs)
    .values({
      userId: user!.id,
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
    .values({ competitionId, userId: user!.id, bestTimeMs: timeMs, runId: run!.id, achievedAt });
}

describe('a week of boards', () => {
  it('is always seven days, Monday to Sunday, with the week’s maps in order', () => {
    const days = weekDays(WEDNESDAY);
    expect(days).toHaveLength(7);
    expect(days[0]!.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(days[6]!.toISOString()).toBe('2026-10-11T00:00:00.000Z');
  });

  it('shows every day, including the ones nobody has played', async () => {
    const monday = await competitionForDay(db, MONDAY);
    await putScore(monday.id, 41_000, new Date('2026-10-05T10:00:00Z'));

    const week = await weekBoards(db, WEDNESDAY, WEDNESDAY);
    expect(week).toHaveLength(7);
    expect(week.map((day) => day.mapNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    // Monday was raced and is over; Tuesday was never started; Wednesday is today; the rest are ahead.
    expect(week.map((day) => day.status)).toEqual([
      'final',
      'final',
      'live',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(week[0]!.players).toBe(1);
    expect(week[0]!.winnerTimeMs).toBe(41_000);
    expect(week[1]!.competitionId).toBeNull();
    expect(week[1]!.players).toBe(0);
  });

  it('counts the players on a live board as they arrive', async () => {
    const wednesday = await competitionForDay(db, WEDNESDAY);
    await putScore(wednesday.id, 50_000, new Date('2026-10-07T10:00:00Z'));
    await putScore(wednesday.id, 44_000, new Date('2026-10-07T11:00:00Z'));

    const week = await weekBoards(db, WEDNESDAY, WEDNESDAY);
    expect(week[2]!.status).toBe('live');
    expect(week[2]!.players).toBe(2);
    // Nothing is frozen while it is still being raced.
    expect(week[2]!.winnerTimeMs).toBeNull();
  });

  it('freezes the days it passes over, so reading the week closes finished boards', async () => {
    const monday = await competitionForDay(db, MONDAY);
    await putScore(monday.id, 41_000, new Date('2026-10-05T10:00:00Z'));

    await weekBoards(db, WEDNESDAY, WEDNESDAY);

    const week = await weekBoards(db, WEDNESDAY, WEDNESDAY);
    expect(week[0]!.status).toBe('final');
    expect(week[0]!.players).toBe(1);
  });
});
