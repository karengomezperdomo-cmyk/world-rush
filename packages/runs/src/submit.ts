import { createHash } from 'node:crypto';
import {
  and,
  asc,
  bestScores,
  competitions,
  eq,
  inArray,
  PG_UNIQUE_VIOLATION,
  pgConstraintName,
  pgErrorCode,
  runs,
  sql,
  type Db,
} from '@worldrush/db';
import {
  decodeReplay,
  MAX_REPLAY_TICKS,
  mapByNumber,
  ReplayError,
  simulateReplay,
  type MapEntry,
  type PhysicsEngine,
} from '@worldrush/game-core';
import {
  competitionForDay,
  CURRENT_RULESET,
  mapForDay,
  submissionWindowOpen,
  type CompetitionRow,
} from './competition';

/**
 * Starting and submitting runs.
 *
 * The rule the whole phase turns on: **the client never states its time.** It states which buttons it
 * pressed; the server re-simulates them and computes the duration itself. What the client claimed is stored
 * beside the verified figure for diagnostics only, because a persistent gap between the two is the
 * signature of a tampered build and keeping both is what makes that visible.
 */

/** Largest replay accepted, in bytes. Generous for a few minutes of play; a ceiling against abuse. */
export const MAX_REPLAY_BYTES = 256 * 1024;

/**
 * How many runs one player may have open at once.
 *
 * This is a bound on concurrency, not a quota on playing. Leaving a run open is ordinary behaviour — it is
 * what happens every time someone closes the app mid-race — so the cap is enforced by closing the player's
 * OLDEST open run rather than by refusing them a new one. See `startRun`.
 */
export const MAX_OPEN_RUNS_PER_USER = 5;

export class SubmissionError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_found'
      | 'window_closed'
      | 'too_large'
      | 'malformed'
      | 'wrong_map'
      | 'ruleset_changed'
      | 'did_not_finish'
      | 'duplicate'
      | 'closed',
  ) {
    super(message);
    this.name = 'SubmissionError';
  }
}

export interface StartedRun {
  readonly runId: string;
  readonly competitionId: string;
  readonly mapSlug: string;
  readonly mapNumber: number;
  readonly ruleset: string;
  readonly startedAt: Date;
}

/**
 * Closes the player's open runs that can never be submitted again.
 *
 * A run whose competition has closed — window plus grace — is not pending, it is finished with. Leaving it
 * as `started` would mean a player's slots were occupied by yesterday's races. The condition is the
 * competition's own window rather than an arbitrary stopwatch, so a run is only ever closed once submitting
 * it has actually become impossible, and a paused game is never killed for taking its time.
 */
async function expireUnsubmittableRuns(db: Db, userId: string, now: Date): Promise<void> {
  await db
    .update(runs)
    .set({
      status: 'expired',
      invalidatedAt: now,
      invalidationReason: 'its competition closed before the run was submitted',
    })
    .where(
      and(
        eq(runs.userId, userId),
        eq(runs.status, 'started'),
        // Correlated on purpose: the deadline is per-competition, because `graceSeconds` is a column.
        sql`exists (select 1 from ${competitions} where ${competitions.id} = ${runs.competitionId} and ${competitions.closesAt} + (${competitions.graceSeconds} * interval '1 second') <= ${now.toISOString()}::timestamptz)`,
      ),
    );
}

/**
 * Abandons the oldest open runs until a new one fits under the cap.
 *
 * The cap used to refuse the new run instead, and that was the wrong way round. Open runs accumulate from
 * closing the app mid-race, which is normal; once five had piled up the player was locked out of ranked
 * play on a working account, with nothing to click to clear them. A run nobody submitted is worth less than
 * the one being started right now, so the old ones give way.
 *
 * Each closed run keeps its reason, so "I lost a time" can be answered from the row rather than guessed at.
 */
async function makeRoomForANewRun(db: Db, userId: string, now: Date): Promise<void> {
  const open = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.status, 'started')))
    .orderBy(asc(runs.startedAt), asc(runs.id));
  if (open.length < MAX_OPEN_RUNS_PER_USER) return;

  const surplus = open.slice(0, open.length - MAX_OPEN_RUNS_PER_USER + 1).map((row) => row.id);
  await db
    .update(runs)
    .set({
      status: 'abandoned',
      invalidatedAt: now,
      invalidationReason: 'abandoned when a newer run was started',
    })
    .where(inArray(runs.id, surplus));
}

/**
 * Issues a run.
 *
 * The server stamps the start time from its own clock, and that stamp is what later decides whether the
 * submission is inside the window. A client-supplied start time would let anyone submit yesterday's race
 * tomorrow.
 *
 * Starting a run never fails because of earlier unfinished ones: stale runs are closed first, and the
 * oldest still-open run gives way if the player is already at the cap.
 */
export async function startRun(db: Db, userId: string, now = new Date()): Promise<StartedRun> {
  const competition = await competitionForDay(db, now);

  await expireUnsubmittableRuns(db, userId, now);
  await makeRoomForANewRun(db, userId, now);

  const map = mapForDay(now);
  const inserted = await db
    .insert(runs)
    .values({
      userId,
      competitionId: competition.id,
      ruleset: competition.ruleset,
      status: 'started',
      startedAt: now,
    })
    .returning();
  const run = inserted[0]!;
  return {
    runId: run.id,
    competitionId: competition.id,
    mapSlug: competition.mapSlug,
    mapNumber: map.number,
    ruleset: competition.ruleset,
    startedAt: run.startedAt,
  };
}

export interface SubmissionResult {
  readonly runId: string;
  /** The duration the SERVER computed. The only number that ranks. */
  readonly durationMs: number;
  readonly isPersonalBest: boolean;
  readonly previousBestMs: number | null;
  readonly rank: number;
  readonly totalPlayers: number;
}

function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(bytes).digest());
}

function mapForCompetition(competition: CompetitionRow): MapEntry {
  const map = mapByNumber(mapForDay(competition.opensAt).number);
  if (!map || map.level.id !== competition.mapSlug) {
    throw new SubmissionError('this competition’s map is no longer available', 'wrong_map');
  }
  return map;
}

/**
 * Verifies a replay and records the result.
 *
 * Every rejection is a verdict about a submission rather than a crash: malformed bytes, the wrong map, a
 * changed ruleset and a run that never reached the line are all normal outcomes of accepting data from the
 * public internet, and each gets its own code so the client can say something useful.
 */
export async function submitRun(
  db: Db,
  engine: PhysicsEngine,
  input: {
    runId: string;
    userId: string;
    replay: Uint8Array;
    claimedDurationMs?: number;
  },
  now = new Date(),
): Promise<SubmissionResult> {
  if (input.replay.byteLength > MAX_REPLAY_BYTES) {
    throw new SubmissionError('replay is too large', 'too_large');
  }

  const found = await db
    .select()
    .from(runs)
    .where(and(eq(runs.id, input.runId), eq(runs.userId, input.userId)))
    .limit(1);
  const run = found[0];
  // Scoped to the caller: asking about someone else's run must be indistinguishable from asking about one
  // that does not exist.
  if (!run) throw new SubmissionError('run not found', 'not_found');
  // A closed run and a submitted one are different things to the player, and saying "already submitted"
  // about a run the server itself closed would be a lie they cannot check.
  if (run.status === 'abandoned' || run.status === 'expired') {
    throw new SubmissionError(
      run.status === 'abandoned'
        ? 'this run was closed when a newer one was started'
        : 'this run was closed because its race had ended',
      'closed',
    );
  }
  if (run.status !== 'started') {
    throw new SubmissionError('this run has already been submitted', 'duplicate');
  }

  const competitionRows = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, run.competitionId))
    .limit(1);
  const competition = competitionRows[0] as CompetitionRow | undefined;
  if (!competition) throw new SubmissionError('competition not found', 'not_found');

  // A frozen board has its ranks written down (`finalize.ts`); accepting a time into it afterwards would
  // add a score the final ranking never counted. Checked as well as the window, not instead of it: the
  // window is the rule, this is the guard against a submission landing while the board is being frozen.
  if (competition.status === 'finalized' || competition.status === 'cancelled') {
    throw new SubmissionError('this race has been closed', 'window_closed');
  }
  if (!submissionWindowOpen(competition, run.startedAt, now)) {
    throw new SubmissionError('the window for this competition has closed', 'window_closed');
  }
  if (competition.ruleset !== CURRENT_RULESET) {
    // The physics changed under this competition; its replays can no longer be re-simulated honestly.
    throw new SubmissionError('the rules changed after this run started', 'ruleset_changed');
  }

  const map = mapForCompetition(competition);

  let decoded;
  try {
    decoded = decodeReplay(input.replay);
  } catch (error) {
    if (error instanceof ReplayError) throw new SubmissionError(error.message, 'malformed');
    throw error;
  }
  if (decoded.levelId !== competition.mapSlug) {
    throw new SubmissionError('replay is for a different map', 'wrong_map');
  }
  if (decoded.ticks > MAX_REPLAY_TICKS) {
    throw new SubmissionError('replay is too long', 'too_large');
  }

  const outcome = simulateReplay(engine, map.level, decoded);
  const replayHash = sha256(input.replay);

  if (!outcome.finished || outcome.durationMs === null) {
    // Not an error: a replay that does not reach the line is simply not a time. Recorded so that repeated
    // near-misses are visible rather than silently discarded.
    await db
      .update(runs)
      .set({
        status: 'invalid',
        submittedAt: now,
        replay: input.replay,
        replayHash,
        claimedDurationMs: input.claimedDurationMs ?? null,
        validation: { finished: false, ticksSimulated: outcome.ticksSimulated },
      })
      .where(eq(runs.id, run.id));
    throw new SubmissionError('this replay does not reach the finish line', 'did_not_finish');
  }

  const durationMs = outcome.durationMs;
  const claimed = input.claimedDurationMs ?? null;
  try {
    await db
      .update(runs)
      .set({
        status: 'valid',
        submittedAt: now,
        completedAt: now,
        durationMs,
        claimedDurationMs: claimed,
        replay: input.replay,
        replayHash,
        // A client that reports a different time from the server's is not necessarily cheating — a stale
        // build does it too — but it is always worth being able to see.
        isSuspicious: claimed !== null && Math.abs(claimed - durationMs) > 50,
        validation: {
          finished: true,
          finishTick: outcome.finishTick,
          crashes: outcome.crashes,
          claimedDurationMs: claimed,
        },
      })
      .where(eq(runs.id, run.id));
  } catch (error) {
    // The unique index on (competition, replay hash) turns a resubmitted file into this. Matched on the
    // SQLSTATE and the constraint name rather than on the error's text, which varies by driver.
    if (
      pgErrorCode(error) === PG_UNIQUE_VIOLATION &&
      pgConstraintName(error) === 'runs_replay_hash_uidx'
    ) {
      throw new SubmissionError('this replay has already been submitted', 'duplicate');
    }
    throw error;
  }

  const previous = await db
    .select()
    .from(bestScores)
    .where(and(eq(bestScores.competitionId, competition.id), eq(bestScores.userId, input.userId)))
    .limit(1);
  const previousBestMs = previous[0]?.bestTimeMs ?? null;
  const isPersonalBest = previousBestMs === null || durationMs < previousBestMs;

  if (isPersonalBest) {
    await db
      .insert(bestScores)
      .values({
        competitionId: competition.id,
        userId: input.userId,
        bestTimeMs: durationMs,
        runId: run.id,
        achievedAt: now,
      })
      .onConflictDoUpdate({
        target: [bestScores.competitionId, bestScores.userId],
        set: { bestTimeMs: durationMs, runId: run.id, achievedAt: now },
        // Guards the race where two submissions land at once: only a genuinely faster time overwrites, so
        // the slower of two concurrent writes cannot undo the faster one.
        where: sql`${bestScores.bestTimeMs} > ${durationMs}`,
      });
  }

  const { rank, totalPlayers } = await rankOf(db, competition.id, input.userId);
  return { runId: run.id, durationMs, isPersonalBest, previousBestMs, rank, totalPlayers };
}

/**
 * Where a player stands, counting only visible scores.
 *
 * The tie-break is first come, first served: an equal time set earlier ranks higher. That is why
 * `achievedAt` is part of both this comparison and the index behind it — without it two equal times would
 * swap places between page loads.
 */
export async function rankOf(
  db: Db,
  competitionId: string,
  userId: string,
): Promise<{ rank: number; totalPlayers: number }> {
  const mine = await db
    .select()
    .from(bestScores)
    .where(and(eq(bestScores.competitionId, competitionId), eq(bestScores.userId, userId)))
    .limit(1);
  const total = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bestScores)
    .where(and(eq(bestScores.competitionId, competitionId), eq(bestScores.isVisible, true)));
  const totalPlayers = total[0]?.count ?? 0;
  const score = mine[0];
  if (!score) return { rank: 0, totalPlayers };

  const ahead = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bestScores)
    .where(
      and(
        eq(bestScores.competitionId, competitionId),
        eq(bestScores.isVisible, true),
        sql`(${bestScores.bestTimeMs}, ${bestScores.achievedAt}, ${bestScores.userId}) < (${score.bestTimeMs}, ${score.achievedAt}, ${score.userId})`,
      ),
    );
  return { rank: (ahead[0]?.count ?? 0) + 1, totalPlayers };
}
