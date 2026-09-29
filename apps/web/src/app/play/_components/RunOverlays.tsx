'use client';

import { CRASH_RESPAWN_TICKS, type MapEntry } from '@worldrush/game-core';
import { Icon } from '../../_components/IconSprite';
import { formatDelta, formatRunTime, runTimeParts } from '../../../lib/run-time';

/**
 * The three states a run can interrupt into, from `design/screens/pause.html`, `crash.html` and
 * `finish.html`. Markup keeps the mocks' class names so the copied `game.css` styles them unchanged.
 *
 * Where the mocks show numbers that only a server can produce — a verified badge, a world rank, a
 * leaderboard position — this shows nothing rather than a placeholder. Phase 7 adds replay submission and
 * re-simulation; until it exists, a green "VERIFIED BY THE SERVER" tick would be a claim the player cannot
 * check and that is not true.
 */

/** Time, rendered with the milliseconds a size smaller, as every mock does. */
function Time({ ticks, className }: { ticks: number; className?: string }) {
  const parts = runTimeParts(ticks);
  return (
    <span className={className}>
      {parts.clock}
      <small>{parts.millis}</small>
    </span>
  );
}

export function PauseOverlay({
  map,
  ticks,
  bestTicks,
  raceEndsIn,
  onResume,
  onRestart,
  onQuit,
}: {
  map: MapEntry;
  ticks: number;
  bestTicks: number | null;
  raceEndsIn: string;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  return (
    <>
      <div className="scrim heavy" />
      <div className="modal modal-centre notch" role="dialog" aria-modal="true" aria-label="Paused">
        <div className="eyebrow">
          MAP {map.number} · {map.name.toUpperCase()}
        </div>
        <div className="banner" style={{ margin: '10px 0 16px' }}>
          PAUSED
        </div>
        <div className="stack">
          <div className="row-kv notch">
            <span className="k">TIME</span>
            <span className="v">{formatRunTime(ticks)}</span>
          </div>
          {bestTicks !== null && (
            <div className="row-kv notch">
              <span className="k">YOUR BEST TODAY</span>
              <span className="v gold">{formatRunTime(bestTicks)}</span>
            </div>
          )}
        </div>
        <div className="stack" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" type="button" onClick={onResume}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <use href="#play" />
            </svg>
            RESUME
          </button>
          <button className="btn btn-secondary notch" type="button" onClick={onRestart}>
            <Icon name="refresh" className="i" />
            RESTART RUN
          </button>
          <button className="btn btn-ghost" type="button" onClick={onQuit}>
            QUIT TO HOME
          </button>
        </div>
        {/* The run's clock is the simulation's, so pausing really does stop it. The DAILY deadline does not,
            and the player has to know that before they decide to sit here. */}
        <p className="hint" style={{ marginTop: 12 }}>
          Pausing stops your run timer, not the day.
          <br />
          RACE ENDS IN <b style={{ color: 'var(--text)' }}>{raceEndsIn}</b>
        </p>
      </div>
    </>
  );
}

export function CrashToast({
  crashedTicksAgo,
  respawnCheckpoint,
}: {
  crashedTicksAgo: number;
  respawnCheckpoint: number | null;
}) {
  const progress = Math.min(100, (crashedTicksAgo / CRASH_RESPAWN_TICKS) * 100);
  return (
    <div className="toast notch" role="status">
      <div className="h">CRASH!</div>
      <div className="p">
        {respawnCheckpoint === null ? 'RESPAWN AT THE START' : `RESPAWN AT CHECKPOINT ${respawnCheckpoint}`}
      </div>
      <div style={{ margin: '10px 0 2px', height: 6, background: '#3a0f1c', position: 'relative' }}>
        <i
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress}%`,
            background: 'var(--red)',
          }}
        />
      </div>
      <div className="p" style={{ marginTop: 6, color: '#9d7d86' }}>
        THE CLOCK KEEPS RUNNING
      </div>
    </div>
  );
}

export function FinishOverlay({
  map,
  ticks,
  splitTicks,
  isBest,
  previousBestTicks,
  onRetry,
  onHome,
}: {
  map: MapEntry;
  ticks: number;
  splitTicks: readonly number[];
  isBest: boolean;
  previousBestTicks: number | null;
  onRetry: () => void;
  onHome: () => void;
}) {
  const bestTicks = isBest ? ticks : (previousBestTicks ?? ticks);
  return (
    <>
      <div className="scrim heavy" />
      <div
        className="modal modal-centre notch"
        style={{ paddingTop: 14 }}
        role="dialog"
        aria-modal="true"
        aria-label="Finished"
      >
        <div className="eyebrow">
          MAP {map.number} · {map.name.toUpperCase()}
        </div>
        <div className="banner gold" style={{ margin: '8px 0 4px' }}>
          FINISH!
        </div>
        <div className="hint" style={{ marginBottom: 8 }}>
          YOUR TIME
        </div>
        <Time ticks={ticks} className="big-time" />

        {isBest && previousBestTicks !== null && (
          <div className="ribbon" style={{ margin: '12px 4px 10px' }}>
            <Icon name="crown" />
            NEW PERSONAL BEST {formatDelta(ticks - previousBestTicks)}
          </div>
        )}

        <div className="stack" style={{ gap: 6 }}>
          <div className="row-kv notch">
            <span className="k">BEST ON THIS DEVICE</span>
            <span className="v gold">{formatRunTime(bestTicks)}</span>
          </div>
        </div>

        {splitTicks.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {splitTicks.map((splitTick, index) => (
              <div className="split-row" key={index}>
                <span>CP {index + 1}</span>
                <b>{formatRunTime(splitTick)}</b>
                <span />
              </div>
            ))}
          </div>
        )}

        {/* Not a verified time. See the note at the top of this file. */}
        <div className="pending-note notch">
          TIME NOT SUBMITTED · SERVER VERIFICATION AND RANKING ARRIVE IN PHASE 7
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <button
            className="btn btn-primary"
            type="button"
            style={{ marginBottom: 6 }}
            onClick={onRetry}
          >
            <Icon name="refresh" className="line" />
            TRY AGAIN
          </button>
          <button className="btn btn-ghost" type="button" style={{ height: 30 }} onClick={onHome}>
            BACK TO HOME
          </button>
        </div>
      </div>
    </>
  );
}
