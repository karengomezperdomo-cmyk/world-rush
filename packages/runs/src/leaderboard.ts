import { and, asc, bestScores, desc, eq, sql, users, type Db } from '@worldrush/db';

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
  /**
   * Whether this player has proved they are a human with World ID.
   *
   * Read per row rather than assumed. The mock puts a "human" badge on every line, which would only be
   * honest if ranking required verification — decision A2 chose that, but it is not enforced yet, so the
   * badge has to follow the data or it is decoration that makes a claim.
   */
  readonly humanVerified: boolean;
  readonly timeMs: number;
  readonly achievedAt: Date;
  readonly isYou: boolean;
}

export interface LeaderboardPage {
  readonly entries: LeaderboardEntry[];
  readonly totalPlayers: number;
  /**
   * The caller's own standing, even when they are far below the visible page.
   *
   * `behindMs` is the gap to the player directly ahead — the one number that tells someone ranked 128th what
   * it would actually take to move up. Null when they are first.
   */
  readonly you: { rank: number; timeMs: number; behindMs: number | null } | null;
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
      humanVerifiedAt: users.humanVerifiedAt,
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
    humanVerified: row.humanVerifiedAt !== null,
    timeMs: row.timeMs,
    achievedAt: row.achievedAt,
    isYou: row.userId === options.viewerId,
  }));

  let you: LeaderboardPage['you'] = null;
  if (options.viewerId) {
    const onPage = entries.find((entry) => entry.isYou);
    if (onPage) {
      const ahead = entries[onPage.rank - 2];
      you = {
        rank: onPage.rank,
        timeMs: onPage.timeMs,
        behindMs: ahead ? onPage.timeMs - ahead.timeMs : null,
      };
    } else {
      // Below the visible page: count how many are ahead rather than fetching the whole board, so a player
      // ranked 9,000th costs the same as one ranked 10th.
      //
      // The timestamp goes in as an ISO string with an explicit cast, not as a Date. A raw Date reaches the
      // driver as a parameter with no type mapping, which PGlite accepts and postgres.js refuses outright
      // ("the string argument must be of type string... received an instance of Date"). Every leaderboard
      // read did this, and only the real-PostgreSQL CI job could ever have seen it.
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
              sql`(${bestScores.bestTimeMs}, ${bestScores.achievedAt}, ${bestScores.userId}) < (${score.bestTimeMs}, ${score.achievedAt.toISOString()}::timestamptz, ${score.userId})`,
            ),
          );
        // The player directly ahead, by the board's own ordering. One row, not the whole page above them:
        // "0.214 behind #127" is the number that says what moving up would take.
        const inFront = await db
          .select({ timeMs: bestScores.bestTimeMs })
          .from(bestScores)
          .where(
            and(
              eq(bestScores.competitionId, competitionId),
              eq(bestScores.isVisible, true),
              sql`(${bestScores.bestTimeMs}, ${bestScores.achievedAt}, ${bestScores.userId}) < (${score.bestTimeMs}, ${score.achievedAt.toISOString()}::timestamptz, ${score.userId})`,
            ),
          )
          .orderBy(
            desc(bestScores.bestTimeMs),
            desc(bestScores.achievedAt),
            desc(bestScores.userId),
          )
          .limit(1);
        you = {
          rank: (ahead[0]?.count ?? 0) + 1,
          timeMs: score.bestTimeMs,
          behindMs: inFront[0] ? score.bestTimeMs - inFront[0].timeMs : null,
        };
      }
    }
  }

  return { entries, totalPlayers, you };
}
