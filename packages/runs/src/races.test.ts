import Box2DFactory from 'box2d3-wasm';
import { bestScores, competitions, eq, runs, users, type Db } from '@worldrush/db';
import { createTestDb, usingRealPostgres } from '@worldrush/db/testing';
import {
  createBikeSimulation,
  INPUT,
  PHYSICS_ENGINE_OPTIONS,
  ReplayRecorder,
  type InputMask,
  type PhysicsEngine,
} from '@worldrush/game-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { competitionForDay, mapForDay } from './competition';
import { finalizeCompetition } from './finalize';
import { MAX_OPEN_RUNS_PER_USER, startRun, submitRun } from './submit';

/**
 * What happens when two things arrive at once.
 *
 * ## What this file proves, and what it does not
 *
 * These tests interleave operations with `Promise.all`. The embedded database (PGlite) runs one statement at
 * a time, so this is **not** lock contention — but the interleaving is real: both callers genuinely read
 * before either writes, which is exactly the ordering that produces a duplicate row, a lost update or a
 * bypassed cap. That is the class of bug unique indexes, conditional updates and `onConflictDoNothing`
 * exist to handle, and it is the class these cover.
 *
 * What they cannot show is anything that depends on one transaction **waiting** for another — `select … for
 * update` in `finalizeCompetition`, or two transactions committing in an order the database picks. One
 * connection cannot express two simultaneous transactions at all, so that needs a real PostgreSQL server,
 * which is why CI runs this suite a second time against one (`.github/workflows/ci.yml`).
 *
 * Saying so matters more than the tests do: "we tested concurrency" is the kind of claim that goes on being
 * believed long after it stopped being true.
 */

let engine: PhysicsEngine;
let local: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;

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

let walletCounter = 0;
async function makeUser(): Promise<string> {
  walletCounter += 1;
  const [row] = await db
    .insert(users)
    .values({ walletAddress: `0x${walletCounter.toString(16).padStart(40, '0')}` })
    .returning();
  return row!.id;
}

function levellingPilot(angle: number): InputMask {
  if (angle > 0.12) return INPUT.GAS | INPUT.LEAN_FORWARD;
  if (angle < -0.12) return INPUT.GAS | INPUT.LEAN_BACK;
  return INPUT.GAS;
}

/**
 * Plays the day's map to the line, optionally braking for the first `brakeTicks`.
 *
 * The brake is how a second, genuinely slower replay is produced: same map, same pilot, different bytes and
 * a different time — which is what a player's second attempt actually looks like, and what the duplicate
 * replay index requires (identical bytes would be rejected as a resubmission, not raced).
 */
function playTheMap(at: Date, brakeTicks = 0): { replay: Uint8Array; durationMs: number } {
  const map = mapForDay(at);
  const simulation = createBikeSimulation(engine, map.level);
  const recorder = new ReplayRecorder(map.level.id);
  let finishTick = 0;
  for (let tick = 0; tick < 60 * 60 * 4; tick += 1) {
    const state = simulation.getState();
    const input = tick < brakeTicks ? INPUT.BRAKE : levellingPilot(state.angle);
    recorder.record(input);
    simulation.step(input);
    const next = simulation.getState();
    if (next.finished) {
      finishTick = next.finishTick ?? next.tick;
      break;
    }
  }
  simulation.dispose();
  return { replay: recorder.encode(), durationMs: Math.round((finishTick / 60) * 1000) };
}

describe('two players arriving at the same moment', () => {
  it('creates exactly one competition for the day', async () => {
    const [first, second, third] = await Promise.all([
      competitionForDay(db, MONDAY),
      competitionForDay(db, MONDAY),
      competitionForDay(db, MONDAY),
    ]);

    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect(await db.select().from(competitions)).toHaveLength(1);
  });
});

describe('one player opening runs faster than they finish them', () => {
  /**
   * **The cap can be overshot by concurrent starts, and this test is here to say so out loud.**
   *
   * Eight simultaneous `startRun` calls all read the open-run list before any of them has inserted, so every
   * one of them concludes there is room and none abandons anything: eight runs end up open against a cap of
   * five. Found by writing this test, not by reasoning about the code.
   *
   * It is left as it is on purpose. The cap exists for hygiene — unfinished runs are ordinary, and since the
   * Phase 7 fix a new run abandons the oldest rather than being refused, so overshooting costs nothing but a
   * few extra rows, and the very next start brings the count back down. Making it a hard bound means taking
   * a lock on the player's row for every single run start: a real cost on the hot path, to defend a number
   * that is not a security boundary. If it ever becomes one, the lock is the answer — and verifying it needs
   * a real PostgreSQL server, because one connection cannot hold two transactions.
   */
  it('can overshoot the cap when starts collide, and heals on the next one', async () => {
    const userId = await makeUser();

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        startRun(db, userId, new Date(MONDAY.getTime() + index * 1000)),
      ),
    );

    const after = await db.select().from(runs).where(eq(runs.userId, userId));
    // Every request succeeded: that is the point of enforcing the cap by abandoning rather than refusing.
    expect(after).toHaveLength(8);
    expect(after.filter((row) => row.status === 'started')).toHaveLength(8);

    // The next start cleans up after the pile-up.
    await startRun(db, userId, new Date(MONDAY.getTime() + 9000));
    const healed = await db.select().from(runs).where(eq(runs.userId, userId));
    expect(healed.filter((row) => row.status === 'started')).toHaveLength(MAX_OPEN_RUNS_PER_USER);
    expect(healed.filter((row) => row.status === 'abandoned')).toHaveLength(4);
  });
});

/**
 * The half of concurrency the embedded database cannot express at all.
 *
 * `finalizeCompetition` opens a transaction and takes `select … for update` on the competition row, so two
 * callers arriving together must end with one waiting for the other and seeing the finished result. One
 * connection cannot hold two transactions, so this is skipped unless the suite is pointed at a real server
 * (`TEST_DATABASE_URL`) — which CI does, in its own job.
 *
 * Skipped rather than deleted: a skipped test says "this is not covered here", while no test says nothing.
 */
describe.skipIf(!usingRealPostgres())('freezing a board from two requests at once', () => {
  it('finalizes exactly once and agrees on the result', async () => {
    const competition = await competitionForDay(db, MONDAY);
    const userId = await makeUser();
    const [run] = await db
      .insert(runs)
      .values({
        userId,
        competitionId: competition.id,
        ruleset: competition.ruleset,
        status: 'valid',
        durationMs: 41_000,
        completedAt: MONDAY,
      })
      .returning();
    await db.insert(bestScores).values({
      competitionId: competition.id,
      userId,
      bestTimeMs: 41_000,
      runId: run!.id,
      achievedAt: MONDAY,
    });

    const after = new Date('2026-10-06T00:05:00Z');
    const results = await Promise.all([
      finalizeCompetition(db, competition.id, after),
      finalizeCompetition(db, competition.id, after),
      finalizeCompetition(db, competition.id, after),
    ]);

    // All three see the same frozen row, and the ranks were written once.
    for (const result of results) {
      expect(result.status).toBe('finalized');
      expect(result.participantsCount).toBe(1);
      expect(result.finalizedAt).toEqual(results[0]!.finalizedAt);
    }
    const [score] = await db
      .select()
      .from(bestScores)
      .where(eq(bestScores.competitionId, competition.id));
    expect(score!.finalRank).toBe(1);
  });
});

describe('two times from the same player landing at once', () => {
  /**
   * `submitRun`'s upsert carries `where bestTimeMs > durationMs`. Without it the slower of two overlapping
   * submissions could overwrite the faster, and a player would watch their best time get worse because two
   * requests happened to cross.
   */
  it('keeps the faster time, whichever order the writes land in', async () => {
    const competition = await competitionForDay(db, MONDAY);
    const userId = await makeUser();
    const fast = playTheMap(MONDAY);
    const slow = playTheMap(MONDAY, 90);
    expect(slow.durationMs).toBeGreaterThan(fast.durationMs);

    const [fastRun, slowRun] = await Promise.all([
      startRun(db, userId, MONDAY),
      startRun(db, userId, MONDAY),
    ]);

    await Promise.all([
      submitRun(db, engine, { runId: slowRun!.runId, userId, replay: slow.replay }, MONDAY),
      submitRun(db, engine, { runId: fastRun!.runId, userId, replay: fast.replay }, MONDAY),
    ]);

    const [score] = await db
      .select()
      .from(bestScores)
      .where(eq(bestScores.competitionId, competition.id));
    expect(score!.bestTimeMs).toBe(fast.durationMs);

    // And a slower time arriving afterwards still does not displace it.
    const third = await startRun(db, userId, MONDAY);
    const slower = playTheMap(MONDAY, 150);
    await submitRun(db, engine, { runId: third.runId, userId, replay: slower.replay }, MONDAY);
    const [after] = await db
      .select()
      .from(bestScores)
      .where(eq(bestScores.competitionId, competition.id));
    expect(after!.bestTimeMs).toBe(fast.durationMs);
  });
});
