import Box2DFactory from 'box2d3-wasm';
import { bestScores, competitions, eq, runs, users } from '@worldrush/db';
import { createTestDb } from '@worldrush/db/testing';
import {
  createBikeSimulation,
  INPUT,
  mapByNumber,
  PHYSICS_ENGINE_OPTIONS,
  ReplayRecorder,
  type InputMask,
  type PhysicsEngine,
} from '@worldrush/game-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { competitionForDay, mapForDay, submissionWindowOpen } from './competition';
import { readLeaderboard } from './leaderboard';
import { startRun, SubmissionError, submitRun } from './submit';

/**
 * End-to-end: play a map, record the inputs, submit them, and let the server decide the time.
 *
 * These tests are the actual proof that the anti-cheat works. A unit test of the verifier would only show
 * that a function returns what it computes; this shows that a replay recorded by a player, carried through
 * the database and re-simulated by the server, produces the same time — and that the obvious forgeries do
 * not produce a faster one.
 */

let engine: PhysicsEngine;
let local: Awaited<ReturnType<typeof createTestDb>>;
let db: Awaited<ReturnType<typeof createTestDb>>['db'];

/** A Monday, so the day's map is map 1. */
const MONDAY = new Date('2026-10-05T12:00:00Z');

beforeAll(async () => {
  engine = await Box2DFactory(PHYSICS_ENGINE_OPTIONS);
});

beforeEach(async () => {
  local = await createTestDb();
  db = local.db;
});

afterEach(async () => {
  await local.close();
});

async function makeUser(wallet: string): Promise<string> {
  const [row] = await db.insert(users).values({ walletAddress: wallet }).returning();
  return row!.id;
}

function levellingPilot(angle: number): InputMask {
  if (angle > 0.12) return INPUT.GAS | INPUT.LEAN_FORWARD;
  if (angle < -0.12) return INPUT.GAS | INPUT.LEAN_BACK;
  return INPUT.GAS;
}

/** Plays the day's map to the line and returns the replay exactly as a client would record it. */
function playTheMap(at: Date): { replay: Uint8Array; finishTick: number } {
  const map = mapForDay(at);
  const simulation = createBikeSimulation(engine, map.level);
  const recorder = new ReplayRecorder(map.level.id);
  let finishTick = 0;
  for (let tick = 0; tick < 60 * 200; tick++) {
    const mask = levellingPilot(simulation.getState().angle);
    recorder.record(mask);
    simulation.step(mask);
    const state = simulation.getState();
    if (state.finished) {
      finishTick = state.finishTick ?? state.tick;
      break;
    }
  }
  simulation.dispose();
  return { replay: recorder.encode(), finishTick };
}

describe('starting a run', () => {
  it('issues a run against the day’s competition, stamped with the server clock', async () => {
    const userId = await makeUser('0x1111111111111111111111111111111111111111');
    const started = await startRun(db, userId, MONDAY);
    expect(started.mapNumber).toBe(1);
    expect(started.mapSlug).toBe('sunset-canyon');
    expect(started.startedAt).toEqual(MONDAY);
  });

  it('creates the competition once, however many players arrive', async () => {
    const first = await makeUser('0x2222222222222222222222222222222222222222');
    const second = await makeUser('0x3333333333333333333333333333333333333333');
    const a = await startRun(db, first, MONDAY);
    const b = await startRun(db, second, MONDAY);
    expect(b.competitionId).toBe(a.competitionId);
  });

  /**
   * The cap bounds how many runs can be open at once; it must never bound how often someone may play.
   * Closing the app mid-race leaves a run open, so a player who did that five times used to be locked out
   * of ranked play on a perfectly good account.
   */
  it('keeps issuing runs at the cap, abandoning the oldest to make room', async () => {
    const userId = await makeUser('0x4444444444444444444444444444444444444444');
    const first = await startRun(db, userId, MONDAY);
    for (let i = 1; i < 5; i++) await startRun(db, userId, new Date(MONDAY.getTime() + i * 1000));

    const sixth = await startRun(db, userId, new Date(MONDAY.getTime() + 5000));
    expect(sixth.runId).toBeTruthy();

    const mine = await db.select().from(runs).where(eq(runs.userId, userId));
    expect(mine.filter((row) => row.status === 'started')).toHaveLength(5);
    const oldest = mine.find((row) => row.id === first.runId)!;
    expect(oldest.status).toBe('abandoned');
    expect(oldest.invalidationReason).toBe('abandoned when a newer run was started');
  });

  it('tells a player their run was closed rather than claiming they already submitted it', async () => {
    const userId = await makeUser('0x9a99999999999999999999999999999999999999');
    const abandoned = await startRun(db, userId, MONDAY);
    for (let i = 1; i <= 5; i++) await startRun(db, userId, new Date(MONDAY.getTime() + i * 1000));

    const { replay } = playTheMap(MONDAY);
    await expect(
      submitRun(db, engine, { runId: abandoned.runId, userId, replay }, MONDAY),
    ).rejects.toMatchObject({ code: 'closed' });
  });

  it('expires runs whose race has ended, instead of holding a slot for ever', async () => {
    const userId = await makeUser('0x9b99999999999999999999999999999999999999');
    const monday = await startRun(db, userId, MONDAY);

    // Tuesday: Monday's competition closed at 00:00 plus its grace, so that run can never be submitted.
    const tuesday = new Date(MONDAY.getTime() + 24 * 60 * 60 * 1000);
    const next = await startRun(db, userId, tuesday);
    expect(next.mapNumber).toBe(2);

    const [stale] = await db.select().from(runs).where(eq(runs.id, monday.runId));
    expect(stale!.status).toBe('expired');
    expect(stale!.invalidatedAt).not.toBeNull();
  });
});

describe('submitting a replay', () => {
  it('records the time the SERVER computed, not the one the client claimed', async () => {
    const userId = await makeUser('0x5555555555555555555555555555555555555555');
    const { replay, finishTick } = playTheMap(MONDAY);
    const started = await startRun(db, userId, MONDAY);

    // The client claims a wildly better time. It must change nothing.
    const result = await submitRun(
      db,
      engine,
      { runId: started.runId, userId, replay, claimedDurationMs: 1 },
      MONDAY,
    );

    const expectedMs = Math.round((finishTick / 60) * 1000);
    expect(result.durationMs).toBe(expectedMs);
    expect(result.rank).toBe(1);

    const [row] = await db.select().from(runs).where(eq(runs.id, started.runId));
    expect(row!.durationMs).toBe(expectedMs);
    expect(row!.claimedDurationMs).toBe(1);
    // The mismatch is kept and flagged rather than quietly dropped.
    expect(row!.isSuspicious).toBe(true);
    expect(row!.status).toBe('valid');
  });

  it('rejects a replay that never reaches the line, and keeps it as evidence', async () => {
    const userId = await makeUser('0x6666666666666666666666666666666666666666');
    const recorder = new ReplayRecorder('sunset-canyon');
    for (let i = 0; i < 120; i++) recorder.record(INPUT.GAS);
    const started = await startRun(db, userId, MONDAY);

    await expect(
      submitRun(db, engine, { runId: started.runId, userId, replay: recorder.encode() }, MONDAY),
    ).rejects.toMatchObject({ code: 'did_not_finish' });

    const [row] = await db.select().from(runs).where(eq(runs.id, started.runId));
    expect(row!.status).toBe('invalid');
    expect(row!.replay).not.toBeNull();
  });

  it('rejects a replay recorded on a different map', async () => {
    const userId = await makeUser('0x7777777777777777777777777777777777777777');
    const otherMap = mapByNumber(3)!;
    const recorder = new ReplayRecorder(otherMap.level.id);
    for (let i = 0; i < 60; i++) recorder.record(INPUT.GAS);
    const started = await startRun(db, userId, MONDAY);
    await expect(
      submitRun(db, engine, { runId: started.runId, userId, replay: recorder.encode() }, MONDAY),
    ).rejects.toMatchObject({ code: 'wrong_map' });
  });

  it('rejects malformed bytes rather than crashing', async () => {
    const userId = await makeUser('0x8888888888888888888888888888888888888888');
    const started = await startRun(db, userId, MONDAY);
    await expect(
      submitRun(db, engine, { runId: started.runId, userId, replay: new Uint8Array(64) }, MONDAY),
    ).rejects.toBeInstanceOf(SubmissionError);
  });

  it('refuses an oversized submission before doing any work', async () => {
    const userId = await makeUser('0x9999999999999999999999999999999999999999');
    const started = await startRun(db, userId, MONDAY);
    await expect(
      submitRun(
        db,
        engine,
        { runId: started.runId, userId, replay: new Uint8Array(300 * 1024) },
        MONDAY,
      ),
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  it('will not let one player submit against another player’s run', async () => {
    const owner = await makeUser('0xaaaa111111111111111111111111111111111111');
    const attacker = await makeUser('0xbbbb222222222222222222222222222222222222');
    const { replay } = playTheMap(MONDAY);
    const started = await startRun(db, owner, MONDAY);
    // Indistinguishable from a run that does not exist: an attacker learns nothing either way.
    await expect(
      submitRun(db, engine, { runId: started.runId, userId: attacker, replay }, MONDAY),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('accepts a run only once', async () => {
    const userId = await makeUser('0xcccc333333333333333333333333333333333333');
    const { replay } = playTheMap(MONDAY);
    const started = await startRun(db, userId, MONDAY);
    await submitRun(db, engine, { runId: started.runId, userId, replay }, MONDAY);
    await expect(
      submitRun(db, engine, { runId: started.runId, userId, replay }, MONDAY),
    ).rejects.toMatchObject({ code: 'duplicate' });
  });

  it('rejects the same replay replayed under a fresh run id', async () => {
    const userId = await makeUser('0x1212999999999999999999999999999999999999');
    const { replay } = playTheMap(MONDAY);

    const first = await startRun(db, userId, MONDAY);
    await submitRun(db, engine, { runId: first.runId, userId, replay }, MONDAY);

    // The earlier duplicate test re-used the same run id, which is caught by the run's own status before the
    // database is ever asked. Submitting the SAME BYTES against a NEW run reaches the unique index instead,
    // and that path shipped broken: the error was matched on its text, which this driver words differently,
    // so a resubmission surfaced as a 500 rather than a refusal.
    const second = await startRun(db, userId, MONDAY);
    await expect(
      submitRun(db, engine, { runId: second.runId, userId, replay }, MONDAY),
    ).rejects.toMatchObject({ code: 'duplicate' });
  });

  it('rejects a replay stolen from another player', async () => {
    const owner = await makeUser('0x1313aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const thief = await makeUser('0x1414bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    const { replay } = playTheMap(MONDAY);

    const theirs = await startRun(db, owner, MONDAY);
    await submitRun(db, engine, { runId: theirs.runId, userId: owner, replay }, MONDAY);

    // Copying someone else's file is the obvious attack once replays are shareable.
    const mine = await startRun(db, thief, MONDAY);
    await expect(
      submitRun(db, engine, { runId: mine.runId, userId: thief, replay }, MONDAY),
    ).rejects.toMatchObject({ code: 'duplicate' });
  });

  it('keeps only the faster of two runs as the personal best', async () => {
    const userId = await makeUser('0xdddd444444444444444444444444444444444444');
    const { replay } = playTheMap(MONDAY);

    const first = await startRun(db, userId, MONDAY);
    const fast = await submitRun(db, engine, { runId: first.runId, userId, replay }, MONDAY);
    expect(fast.isPersonalBest).toBe(true);

    // A slower run: the same inputs with a stretch of idling in front of them.
    const slowRecorder = new ReplayRecorder('sunset-canyon');
    for (let i = 0; i < 180; i++) slowRecorder.record(0 as InputMask);
    const map = mapForDay(MONDAY);
    const simulation = createBikeSimulation(engine, map.level);
    for (let i = 0; i < 180; i++) simulation.step(0 as InputMask);
    for (let tick = 0; tick < 60 * 200; tick++) {
      const mask = levellingPilot(simulation.getState().angle);
      slowRecorder.record(mask);
      simulation.step(mask);
      if (simulation.getState().finished) break;
    }
    simulation.dispose();

    const second = await startRun(db, userId, MONDAY);
    const slow = await submitRun(
      db,
      engine,
      { runId: second.runId, userId, replay: slowRecorder.encode() },
      MONDAY,
    );
    expect(slow.isPersonalBest).toBe(false);
    expect(slow.durationMs).toBeGreaterThan(fast.durationMs);

    const [best] = await db.select().from(bestScores).where(eq(bestScores.userId, userId));
    expect(best!.bestTimeMs).toBe(fast.durationMs);
  });
});

describe('the leaderboard', () => {
  it('orders by time, and breaks ties by who got there first', async () => {
    const competition = await competitionForDay(db, MONDAY);
    const early = await makeUser('0xeeee555555555555555555555555555555555555');
    const late = await makeUser('0xffff666666666666666666666666666666666666');
    const quicker = await makeUser('0x1010777777777777777777777777777777777777');

    const seed = async (userId: string, timeMs: number, achievedAt: Date) => {
      const [run] = await db
        .insert(runs)
        .values({
          userId,
          competitionId: competition.id,
          ruleset: competition.ruleset,
          status: 'valid',
          durationMs: timeMs,
          completedAt: achievedAt,
        })
        .returning();
      await db.insert(bestScores).values({
        competitionId: competition.id,
        userId,
        bestTimeMs: timeMs,
        runId: run!.id,
        achievedAt,
      });
    };

    // Two identical times, set an hour apart, plus one genuinely faster.
    await seed(late, 45_000, new Date('2026-10-05T11:00:00Z'));
    await seed(early, 45_000, new Date('2026-10-05T09:00:00Z'));
    await seed(quicker, 44_000, new Date('2026-10-05T13:00:00Z'));

    const board = await readLeaderboard(db, competition.id, { viewerId: late });
    expect(board.entries.map((entry) => entry.userId)).toEqual([quicker, early, late]);
    expect(board.totalPlayers).toBe(3);
    // Third place is a second behind second place — the number that says what moving up would take, and
    // zero here because the two tied times differ only in who got there first.
    expect(board.you).toEqual({ rank: 3, timeMs: 45_000, behindMs: 0 });
    // Nobody in this test verified with World ID, so no row may claim they did.
    expect(board.entries.every((entry) => entry.humanVerified)).toBe(false);
  });

  it('tells a player their rank even when they are below the visible page', async () => {
    const competition = await competitionForDay(db, MONDAY);
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      ids.push(await makeUser(`0x${String(i).repeat(40).slice(0, 40)}`));
    }
    for (const [index, userId] of ids.entries()) {
      const [run] = await db
        .insert(runs)
        .values({
          userId,
          competitionId: competition.id,
          ruleset: competition.ruleset,
          status: 'valid',
          durationMs: 40_000 + index * 1000,
          completedAt: MONDAY,
        })
        .returning();
      await db.insert(bestScores).values({
        competitionId: competition.id,
        userId,
        bestTimeMs: 40_000 + index * 1000,
        runId: run!.id,
        achievedAt: MONDAY,
      });
    }
    const board = await readLeaderboard(db, competition.id, { viewerId: ids[5]!, limit: 3 });
    expect(board.entries).toHaveLength(3);
    expect(board.entries.some((entry) => entry.isYou)).toBe(false);
    // Counted rather than fetched: being 9,000th must cost the same as being 10th. The gap is to the player
    // directly ahead (44,000 ms), not to the leader, and is read with one more row, not one more page.
    expect(board.you).toEqual({ rank: 6, timeMs: 45_000, behindMs: 1_000 });
  });

  it('marks the players who proved they are human, and only those', async () => {
    const competition = await competitionForDay(db, MONDAY);
    const verified = await makeUser('0x3030999999999999999999999999999999999999');
    const anonymous = await makeUser('0x4040aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    await db
      .update(users)
      .set({ humanVerifiedAt: MONDAY })
      .where(eq(users.id, verified));

    for (const [index, userId] of [verified, anonymous].entries()) {
      const [run] = await db
        .insert(runs)
        .values({
          userId,
          competitionId: competition.id,
          ruleset: competition.ruleset,
          status: 'valid',
          durationMs: 40_000 + index * 1000,
          completedAt: MONDAY,
        })
        .returning();
      await db.insert(bestScores).values({
        competitionId: competition.id,
        userId,
        bestTimeMs: 40_000 + index * 1000,
        runId: run!.id,
        achievedAt: MONDAY,
      });
    }

    const board = await readLeaderboard(db, competition.id);
    expect(board.entries.map((entry) => entry.humanVerified)).toEqual([true, false]);
  });

  it('shows nothing for a player who has not set a time', async () => {
    const competition = await competitionForDay(db, MONDAY);
    const stranger = await makeUser('0x2020888888888888888888888888888888888888');
    const board = await readLeaderboard(db, competition.id, { viewerId: stranger });
    expect(board.you).toBeNull();
    expect(board.entries).toHaveLength(0);
  });
});

describe('the submission window', () => {
  const competition = {
    opensAt: new Date('2026-10-05T00:00:00Z'),
    closesAt: new Date('2026-10-06T00:00:00Z'),
    graceSeconds: 120,
  };

  it('accepts a run finished just after the close, if it started before it', () => {
    // Finishing at 23:59:58 must not be unrankable through no fault of the player.
    const startedAt = new Date('2026-10-05T23:59:00Z');
    expect(submissionWindowOpen(competition, startedAt, new Date('2026-10-06T00:01:30Z'))).toBe(true);
  });

  it('refuses one submitted long after the grace has run out', () => {
    const startedAt = new Date('2026-10-05T23:59:00Z');
    expect(submissionWindowOpen(competition, startedAt, new Date('2026-10-06T00:05:00Z'))).toBe(false);
  });

  it('refuses a run that started after the competition closed', () => {
    const startedAt = new Date('2026-10-06T00:00:30Z');
    expect(submissionWindowOpen(competition, startedAt, new Date('2026-10-06T00:00:40Z'))).toBe(false);
  });

  /**
   * The guard against the one ordering the window alone does not cover: a submission arriving while the
   * board is being frozen. A score added after the ranks were written would sit on a final board without a
   * final rank.
   */
  it('refuses a submission into a board that has already been frozen', async () => {
    const userId = await makeUser('0x9c99999999999999999999999999999999999999');
    const { replay } = playTheMap(MONDAY);
    const started = await startRun(db, userId, MONDAY);

    await db
      .update(competitions)
      .set({ status: 'finalized', finalizedAt: MONDAY })
      .where(eq(competitions.id, started.competitionId));

    await expect(
      submitRun(db, engine, { runId: started.runId, userId, replay }, MONDAY),
    ).rejects.toMatchObject({ code: 'window_closed' });
  });
});
