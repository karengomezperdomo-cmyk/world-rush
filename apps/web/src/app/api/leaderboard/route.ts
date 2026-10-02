import { competitionForDay, readLeaderboard } from '@worldrush/runs';
import { getDb } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/session-cookie';

export const dynamic = 'force-dynamic';

/**
 * Today's leaderboard.
 *
 * Readable without signing in — a board nobody can look at is not much of a board — but the viewer's own
 * standing is only included when there is a session to attach it to.
 *
 * User ids are deliberately not returned. The board needs a name and a time; handing out internal ids to
 * anyone who asks would let a caller enumerate the players.
 */
export async function GET(): Promise<Response> {
  const session = await getCurrentSession();
  const db = await getDb();
  const competition = await competitionForDay(db, new Date());
  const board = await readLeaderboard(db, competition.id, { viewerId: session?.userId });

  return Response.json({
    mapSlug: competition.mapSlug,
    closesAt: competition.closesAt,
    totalPlayers: board.totalPlayers,
    you: board.you,
    entries: board.entries.map((entry) => ({
      rank: entry.rank,
      // World's guidelines: show the username, never the wallet address.
      username: entry.username,
      timeMs: entry.timeMs,
      isYou: entry.isYou,
    })),
  });
}
