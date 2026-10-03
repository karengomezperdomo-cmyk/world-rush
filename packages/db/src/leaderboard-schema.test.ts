import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bestScores,
  competitions,
  PG_CHECK_VIOLATION,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
  runs,
  users,
} from './index';
import { createTestDb } from './testing';

/**
 * The Phase 7 tables, checked against a real PostgreSQL (PGlite) with the migrations applied.
 *
 * These are constraint tests, not query tests. Every rule here is one the database enforces by itself,
 * because the leaderboard's integrity cannot depend on the application remembering to be careful: a second
 * server, a retried request or a future endpoint must all hit the same wall.
 */

let local: Awaited<ReturnType<typeof createTestDb>>;
let db: Awaited<ReturnType<typeof createTestDb>>['db'];

async function sqlstateOf(promise: PromiseLike<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return pgErrorCode(error);
  }
}

const DAY = new Date('2026-10-05T00:00:00Z');

/** The Monday of the week containing `day`, in UTC — which is how competitions are grouped. */
function mondayOf(day: Date): Date {
  const monday = new Date(day);
  const weekday = monday.getUTCDay() === 0 ? 7 : monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (weekday - 1));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/**
 * Derives `weekStart` from `day` unless a test sets it explicitly. An earlier version pinned every
 * competition to one week, which made the "a map runs once a week" constraint fire on the second insert of
 * any test — the constraint working correctly against a careless fixture.
 */
let slugCounter = 0;

async function makeCompetition(overrides: Partial<typeof competitions.$inferInsert> = {}) {
  const day = overrides.day ?? DAY;
  // Each fixture gets its own map by default. Several tests land in the same week, and sharing a slug there
  // trips "a map runs once a week" — the constraint doing its job against a lazy fixture, not a bug.
  slugCounter += 1;
  const [row] = await db
    .insert(competitions)
    .values({
      mapSlug: `test-map-${slugCounter}`,
      levelFingerprint: 'deadbeef',
      ruleset: 'r1',
      day,
      weekStart: mondayOf(day),
      opensAt: day,
      closesAt: new Date(day.getTime() + 24 * 60 * 60 * 1000),
      ...overrides,
    })
    .returning();
  return row!;
}

async function makeUser(wallet: string) {
  const [row] = await db.insert(users).values({ walletAddress: wallet }).returning();
  return row!;
}

beforeAll(async () => {
  local = await createTestDb();
  db = local.db;
});

afterAll(async () => {
  await local.close();
});

describe('competitions', () => {
  it('accepts a well-formed competition', async () => {
    const competition = await makeCompetition({ day: new Date('2026-11-02T00:00:00Z') });
    expect(competition.status).toBe('scheduled');
    expect(competition.graceSeconds).toBe(120);
  });

  it('refuses a window that closes before it opens', async () => {
    const code = await sqlstateOf(
      makeCompetition({
        day: new Date('2026-11-03T00:00:00Z'),
        opensAt: new Date('2026-11-03T10:00:00Z'),
        closesAt: new Date('2026-11-03T09:00:00Z'),
      }),
    );
    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  it('refuses a status outside the known set', async () => {
    const code = await sqlstateOf(
      makeCompetition({ day: new Date('2026-11-04T00:00:00Z'), status: 'whatever' }),
    );
    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  it('allows only one competition per day', async () => {
    const day = new Date('2026-11-05T00:00:00Z');
    await makeCompetition({ day });
    const code = await sqlstateOf(makeCompetition({ day, mapSlug: 'coral-coast' }));
    expect(code).toBe(PG_UNIQUE_VIOLATION);
  });

  it('refuses to run the same map twice in one week', async () => {
    const weekStart = new Date('2026-11-09T00:00:00Z');
    await makeCompetition({
      day: new Date('2026-11-09T00:00:00Z'),
      weekStart,
      mapSlug: 'frost-peak',
    });
    // Same week, same map, different day: the whole point of the constraint.
    const code = await sqlstateOf(
      makeCompetition({ day: new Date('2026-11-10T00:00:00Z'), weekStart, mapSlug: 'frost-peak' }),
    );
    expect(code).toBe(PG_UNIQUE_VIOLATION);
  });
});

describe('runs', () => {
  it('cannot be marked valid without the evidence for its own claim', async () => {
    const competition = await makeCompetition({ day: new Date('2026-12-01T00:00:00Z') });
    const user = await makeUser('0x1111111111111111111111111111111111111111');
    // A time with no completion timestamp, or a completion with no time, is a half-written record. The
    // database refuses it rather than letting a partially verified run reach a leaderboard.
    const code = await sqlstateOf(
      db.insert(runs).values({
        userId: user.id,
        competitionId: competition.id,
        ruleset: 'r1',
        status: 'valid',
      }),
    );
    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  it('accepts a valid run that carries both its time and its completion', async () => {
    const competition = await makeCompetition({ day: new Date('2026-12-02T00:00:00Z') });
    const user = await makeUser('0x2222222222222222222222222222222222222222');
    const [run] = await db
      .insert(runs)
      .values({
        userId: user.id,
        competitionId: competition.id,
        ruleset: 'r1',
        status: 'valid',
        durationMs: 45_600,
        completedAt: new Date(),
      })
      .returning();
    expect(run!.durationMs).toBe(45_600);
    expect(run!.isSuspicious).toBe(false);
  });

  it('refuses a non-positive duration', async () => {
    const competition = await makeCompetition({ day: new Date('2026-12-03T00:00:00Z') });
    const user = await makeUser('0x3333333333333333333333333333333333333333');
    const code = await sqlstateOf(
      db.insert(runs).values({
        userId: user.id,
        competitionId: competition.id,
        ruleset: 'r1',
        durationMs: 0,
      }),
    );
    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  it('rejects the same replay submitted twice to one competition', async () => {
    const competition = await makeCompetition({ day: new Date('2026-12-04T00:00:00Z') });
    const user = await makeUser('0x4444444444444444444444444444444444444444');
    const hash = new Uint8Array(32).fill(7);
    await db
      .insert(runs)
      .values({ userId: user.id, competitionId: competition.id, ruleset: 'r1', replayHash: hash });
    // Replaying someone else's file, or your own twice, is one entry — not two.
    const code = await sqlstateOf(
      db.insert(runs).values({
        userId: user.id,
        competitionId: competition.id,
        ruleset: 'r1',
        replayHash: hash,
      }),
    );
    expect(code).toBe(PG_UNIQUE_VIOLATION);
  });

  it('allows the same replay bytes against a different competition', async () => {
    const hash = new Uint8Array(32).fill(9);
    const user = await makeUser('0x5555555555555555555555555555555555555555');
    const first = await makeCompetition({ day: new Date('2026-12-05T00:00:00Z') });
    const second = await makeCompetition({
      day: new Date('2026-12-06T00:00:00Z'),
      mapSlug: 'coral-coast',
    });
    expect(second.id).not.toBe(first.id);
    await db
      .insert(runs)
      .values({ userId: user.id, competitionId: first.id, ruleset: 'r1', replayHash: hash });
    const code = await sqlstateOf(
      db
        .insert(runs)
        .values({ userId: user.id, competitionId: second.id, ruleset: 'r1', replayHash: hash }),
    );
    // Identical inputs on two different maps are two legitimate runs, so the uniqueness is scoped.
    expect(code).toBeUndefined();
  });
});

describe('best scores', () => {
  async function seedScore(wallet: string, timeMs: number, day: string) {
    const competition = await makeCompetition({ day: new Date(day) });
    const user = await makeUser(wallet);
    const [run] = await db
      .insert(runs)
      .values({
        userId: user.id,
        competitionId: competition.id,
        ruleset: 'r1',
        status: 'valid',
        durationMs: timeMs,
        completedAt: new Date(),
      })
      .returning();
    await db.insert(bestScores).values({
      competitionId: competition.id,
      userId: user.id,
      bestTimeMs: timeMs,
      runId: run!.id,
    });
    return { competition, user };
  }

  it('holds one row per player per competition', async () => {
    const { competition, user } = await seedScore(
      '0x6666666666666666666666666666666666666666',
      44_000,
      '2027-01-04T00:00:00Z',
    );
    const [run] = await db.select().from(runs).where(eq(runs.userId, user.id));
    // A second row for the same player would mean two places on one board for one person.
    const code = await sqlstateOf(
      db.insert(bestScores).values({
        competitionId: competition.id,
        userId: user.id,
        bestTimeMs: 40_000,
        runId: run!.id,
      }),
    );
    expect(code).toBe(PG_UNIQUE_VIOLATION);
  });

  it('refuses a non-positive best time', async () => {
    const competition = await makeCompetition({ day: new Date('2027-01-05T00:00:00Z') });
    const user = await makeUser('0x7777777777777777777777777777777777777777');
    const [run] = await db
      .insert(runs)
      .values({ userId: user.id, competitionId: competition.id, ruleset: 'r1' })
      .returning();
    const code = await sqlstateOf(
      db.insert(bestScores).values({
        competitionId: competition.id,
        userId: user.id,
        bestTimeMs: -1,
        runId: run!.id,
      }),
    );
    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  it('refuses two players sharing one final rank', async () => {
    const competition = await makeCompetition({ day: new Date('2027-01-06T00:00:00Z') });
    const first = await makeUser('0x8888888888888888888888888888888888888888');
    const second = await makeUser('0x9999999999999999999999999999999999999999');
    const insertScore = async (userId: string, timeMs: number, finalRank: number) => {
      const [run] = await db
        .insert(runs)
        .values({
          userId,
          competitionId: competition.id,
          ruleset: 'r1',
          status: 'valid',
          durationMs: timeMs,
          completedAt: new Date(),
        })
        .returning();
      return db.insert(bestScores).values({
        competitionId: competition.id,
        userId,
        bestTimeMs: timeMs,
        runId: run!.id,
        finalRank,
      });
    };
    await insertScore(first.id, 41_000, 1);
    // Freezing the board must produce one winner, not two.
    expect(await sqlstateOf(insertScore(second.id, 42_000, 1))).toBe(PG_UNIQUE_VIOLATION);
  });
});
