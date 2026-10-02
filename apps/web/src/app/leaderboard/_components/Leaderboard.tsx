'use client';

import { useEffect, useState } from 'react';
import { formatRunTime } from '../../../lib/run-time';
import { Icon } from '../../_components/IconSprite';
import { TabBar } from '../../_components/TabBar';

/**
 * Today's leaderboard.
 *
 * Every time here was computed by the server from the inputs the player pressed, not reported by their
 * device — which is what makes a board worth looking at. Ties go to whoever got there first.
 */

interface Entry {
  rank: number;
  username: string | null;
  timeMs: number;
  isYou: boolean;
}

interface Board {
  mapSlug: string;
  totalPlayers: number;
  you: { rank: number; timeMs: number } | null;
  entries: Entry[];
}

/** Times arrive in milliseconds; `formatRunTime` works in simulation ticks. */
const TICKS_PER_MS = 60 / 1000;

function medalClass(rank: number): string {
  if (rank === 1) return 'lb-row gold notch';
  if (rank === 2) return 'lb-row silver notch';
  if (rank === 3) return 'lb-row bronze notch';
  return 'lb-row notch';
}

export function Leaderboard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/leaderboard', { cache: 'no-store' });
        if (!response.ok) throw new Error(String(response.status));
        setBoard((await response.json()) as Board);
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  return (
    <div className="screen">
      <div className="page">
        <div className="title-row">
          <h1>LEADERBOARD</h1>
          <p>
            {board ? `TODAY · ${board.totalPlayers.toLocaleString()} RIDERS` : 'TODAY’S RACE'}
          </p>
        </div>

        {failed && (
          <div className="card notch" role="alert">
            <div className="ico notch">
              <Icon name="alert" />
            </div>
            <div>
              <h3>COULD NOT LOAD THE BOARD</h3>
              <p>Check your connection and try again.</p>
            </div>
          </div>
        )}

        {!board && !failed && <p className="lb-empty">Loading…</p>}

        {board && board.entries.length === 0 && (
          <div className="card notch">
            <div className="ico notch">
              <Icon name="flag" />
            </div>
            <div>
              <h3>NOBODY HAS FINISHED YET</h3>
              <p>No verified time has been set on today’s map. The first one could be yours.</p>
            </div>
          </div>
        )}

        {board && board.entries.length > 0 && (
          <div className="lb">
            {board.entries.map((entry) => (
              <div className={medalClass(entry.rank)} key={`${entry.rank}-${entry.username ?? ''}`}>
                <span className="pos">{entry.rank}</span>
                {/* World's guidelines: usernames, never wallet addresses. */}
                <span className="who">
                  {entry.username ?? 'RIDER'}
                  {entry.isYou && <span className="you-tag">YOU</span>}
                </span>
                <span className="t">{formatRunTime(entry.timeMs * TICKS_PER_MS)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Shown when the player is ranked below the visible page, so they always know where they stand. */}
        {board?.you && !board.entries.some((entry) => entry.isYou) && (
          <div className="lb-row pinned notch">
            <span className="pos">{board.you.rank}</span>
            <span className="who">
              YOU<span className="you-tag">YOU</span>
            </span>
            <span className="t">{formatRunTime(board.you.timeMs * TICKS_PER_MS)}</span>
          </div>
        )}
      </div>

      <TabBar active="leaderboard" />
    </div>
  );
}
