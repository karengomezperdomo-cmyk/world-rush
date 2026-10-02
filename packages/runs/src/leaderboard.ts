import { and, asc, bestScores, eq, sql, users, type Db } from '@worldrush/db';

/**
 * Reading a leaderboard.
 *
 * There is no leaderboard table: this is an ordered read of `best_scores`, which is why the ordering here
 * and the index behind it have to match exactly — time, then who got there first, then user id. That full
 * tie-break is what makes the board stable: without `achievedAt` two equal times would swap places between
 * page loads, and without the user id two equal times set in the same millisecond would.
 *
 * "First come, first served" is the rule the owner chose: an equal time set earlier ranks higher.
 */

export interface LeaderboardEntry {
  readonly rank: number;
  readonly userId: string;
  /** World guidelines: show the username, never the wallet address. Null when one is not resolved yet. */
  readonly username: string | null;
  readonly timeMs: number;
  readonly achievedAt: Date;
  readonly isYou: boolean;
}

export interface LeaderboardPage {
  readonly entries: LeaderboardEntry[];
  readonly totalPlayers: number;
  /** The caller's own standing, even when they are far below the visible page. */
  readonly you: { rank: number; timeMs: number } | null;
}

export const LEADERBOARD_PAGE_SIZE = 50;

export async function readLeaderboard(
  db: Db,
  competitionId: string,
  options: { viewerId?: string; limit?: number } = {},
): Promise<LeaderboardPage> {
  const limit = Math.min(options.limit ?? LEADERBOARD_PAGE_SIZE, LEADERBOARD_PAGE_SIZE);

  const rows = await db
    .select({
      userId: bestScores.userId,
      timeMs: bestScores.bestTimeMs,
      achievedAt: bestScores.achievedAt,
      username: users.username,
    })
    .from(bestScores)
    .innerJoin(users, eq(users.id, bestScores.userId))
    .where(and(eq(bestScores.competitionId, competitionId), eq(bestScores.isVisible, true)))
    .orderBy(asc(bestScores.bestTimeMs), asc(bestScores.achievedAt), asc(bestScores.userId))
    .limit(limit);

  const totals = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bestScores)
    .where(and(eq(bestScores.competitionId, competitionId), eq(bestScores.isVisible, true)));
  const totalPlayers = totals[0]?.count ?? 0;

  const entries: LeaderboardEntry[] = rows.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    username: row.username,
    timeMs: row.timeMs,
    achievedAt: row.achievedAt,
    isYou: row.userId === options.viewerId,
  }));

  let you: LeaderboardPage['you'] = null;
  if (options.viewerId) {
    const onPage = entries.find((entry) => entry.isYou);
    if (onPage) {
      you = { rank: onPage.rank, timeMs: onPage.timeMs };
    } else {
      // Below the visible page: count how many are ahead rather than fetching the whole board, so a player
      // ranked 9,000th costs the same as one ranked 10th.
      const mine = await db
        .select()
        .from(bestScores)
        .where(
          and(
            eq(bestScores.competitionId, competitionId),
            eq(bestScores.userId, options.viewerId),
            eq(bestScores.isVisible, true),
          ),
        )
        .limit(1);
      const score = mine[0];
      if (score) {
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
        you = { rank: (ahead[0]?.count ?? 0) + 1, timeMs: score.bestTimeMs };
      }
    }
  }

  return { entries, totalPlayers, you };
}
