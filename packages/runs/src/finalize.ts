import { and, bestScores, competitions, eq, sql, type Db } from '@worldrush/db';
import { dayKeyUtc, weekStartUtc, type CompetitionRow } from './competition';

/**
 * Closing a day: freezing a board once its race is over.
 *
 * ## Why this is lazy, and not a scheduled job
 *
 * Finalization runs on first read of a competition that is due for it, inside a transaction that locks the
 * row. A cron job may call `finalizeDueCompetitions` as well, and should, but **correctness never depends on
 * it**: Vercel's Hobby plan runs cron at most once a day with up to an hour of imprecision
 * (`docs/phase-0/02-architecture-proposal.md` §19, `docs/DECISIONS.md` §3), so a design that only froze a
 * board when a job happened to fire would leave yesterday's leaderboard live for an unpredictable stretch of
 * today. Doing it on read means the first person to look is the one who pays for it, and everyone — including
 * the job — sees the same frozen answer afterwards.
 *
 * ## What freezing actually means
 *
 * The live board is an ordered query, so it already changes as times arrive. Finalizing writes that order
 * down: every visible score gets its `finalRank`, and the competition records how many played and what won.
 * After that the board is a record of what happened rather than a query whose answer could drift if a score
 * were later hidden by moderation.
 */

/** A run may still be submitted until the window plus its grace has passed; until then nothing is final. */
export function competitionIsOver(
  competition: Pick<CompetitionRow, 'closesAt' | 'graceSeconds'>,
  now: Date,
): boolean {
  return now.getTime() > competition.closesAt.getTime() + competition.graceSeconds * 1000;
}

/** Whether this competition is past due for finalization. `cancelled` boards are never finalized. */
export function finalizationDue(competition: CompetitionRow, now: Date): boolean {
  if (competition.status === 'finalized' || competition.status === 'cancelled') return false;
  return competitionIsOver(competition, now);
}

/**
 * Freezes one competition, if it is due. Idempotent, and safe to call concurrently.
 *
 * The row is locked for the duration (`select … for update`), so two readers arriving at the same moment do
 * not both write ranks: the second waits, sees `finalized`, and returns the first one's answer. Calling it
 * on a competition that is still running, already finalized or cancelled is not an error — it returns the
 * row untouched, which is what makes it safe to call on every read.
 */
export async function finalizeCompetition(
  db: Db,
  competitionId: string,
  now = new Date(),
): Promise<CompetitionRow> {
  return db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1)
      .for('update');
    const competition = locked[0] as CompetitionRow | undefined;
    if (!competition) throw new Error(`no competition ${competitionId}`);
    if (!finalizationDue(competition, now)) return competition;

    // One statement, so the ranks are a single consistent snapshot of the board. The order is the board's
    // own tie-break — time, then who got there first, then user id — and it has to stay identical to
    // `readLeaderboard`'s, or the frozen numbers would disagree with the list they were computed from.
    await tx.execute(sql`
      update ${bestScores} as bs
      set final_rank = ranked.rn
      from (
        select user_id, row_number() over (
          order by best_time_ms asc, achieved_at asc, user_id asc
        ) as rn
        from ${bestScores}
        where competition_id = ${competitionId} and is_visible
      ) as ranked
      where bs.competition_id = ${competitionId} and bs.user_id = ranked.user_id
    `);

    const totals = await tx
      .select({
        players: sql<number>`count(*)::int`,
        winner: sql<number | null>`min(${bestScores.bestTimeMs})`,
      })
      .from(bestScores)
      .where(and(eq(bestScores.competitionId, competitionId), eq(bestScores.isVisible, true)));

    const updated = await tx
      .update(competitions)
      .set({
        status: 'finalized',
        finalizedAt: now,
        participantsCount: totals[0]?.players ?? 0,
        // Null when nobody finished. A day with no times is a real outcome, not a missing value to invent.
        winnerTimeMs: totals[0]?.winner ?? null,
      })
      .where(eq(competitions.id, competitionId))
      .returning();
    return updated[0] as CompetitionRow;
  });
}

/**
 * Finds a day's competition WITHOUT creating one.
 *
 * `competitionForDay` creates on demand, which is right when a player starts a run and wrong everywhere
 * else: a leaderboard URL carrying a date must not be able to conjure rows for days that never ran, whether
 * that date is a typo, a crawler or someone counting backwards through the calendar.
 */
export async function findCompetition(db: Db, day: Date): Promise<CompetitionRow | undefined> {
  const rows = await db
    .select()
    .from(competitions)
    .where(eq(competitions.day, dayKeyUtc(day)))
    .limit(1);
  return rows[0] as CompetitionRow | undefined;
}

/**
 * A day's competition, frozen first if its race is over.
 *
 * This is what every read path should use: it is the one place that guarantees a board nobody has looked at
 * since it closed is finalized before it is shown.
 */
export async function competitionForReading(
  db: Db,
  day: Date,
  now = new Date(),
): Promise<CompetitionRow | undefined> {
  const competition = await findCompetition(db, day);
  if (!competition) return undefined;
  if (!finalizationDue(competition, now)) return competition;
  return finalizeCompetition(db, competition.id, now);
}

/**
 * The competitions of the week containing `at`, oldest first, each finalized if it is due.
 *
 * Days that never ran are simply absent — there is no row to invent for a day on which nobody played, and
 * the caller knows the seven maps of a week from `game-core` anyway.
 */
export async function weekCompetitions(db: Db, at: Date, now = new Date()): Promise<CompetitionRow[]> {
  const week = weekStartUtc(at);
  const rows = (await db
    .select()
    .from(competitions)
    .where(eq(competitions.weekStart, week))
    .orderBy(competitions.day)) as CompetitionRow[];

  const out: CompetitionRow[] = [];
  for (const row of rows) {
    out.push(finalizationDue(row, now) ? await finalizeCompetition(db, row.id, now) : row);
  }
  return out;
}

/**
 * Freezes every competition that is due, for a cron job to call.
 *
 * Returns how many it closed. Nothing depends on this running — see the note at the top of the file — so an
 * hour of imprecision, or a day when it does not fire at all, costs nothing but the first reader's latency.
 */
export async function finalizeDueCompetitions(db: Db, now = new Date()): Promise<number> {
  const due = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(
      and(
        sql`${competitions.status} not in ('finalized', 'cancelled')`,
        sql`${competitions.closesAt} + (${competitions.graceSeconds} * interval '1 second') < ${now.toISOString()}::timestamptz`,
      ),
    );
  let closed = 0;
  for (const row of due) {
    const after = await finalizeCompetition(db, row.id, now);
    if (after.status === 'finalized') closed += 1;
  }
  return closed;
}
