'use client';

import { CRASH_RESPAWN_TICKS, type MapEntry } from '@worldrush/game-core';
import { Icon } from '../../_components/IconSprite';
import { formatDelta, formatRunTime, runTimeParts } from '../../../lib/run-time';
import type { SubmissionFailure, SubmittedTime } from '../../../lib/submission';

/**
 * The three states a run can interrupt into, from `design/screens/pause.html`, `crash.html` and
 * `finish.html`. Markup keeps the mocks' class names so the copied `game.css` styles them unchanged.
 *
 * The finish screen's rank and verified badge are now real: Phase 7 submits the recorded inputs, the server
 * re-simulates them and returns the time IT computed. The badge appears only for a time that came back from
 * that check — never for one the client worked out for itself.
 *
 * When a run is not ranked, the screen says which of the reasons it was. "Not submitted" and "refused" are
 * very different things to a player, and collapsing them into a shrug would be the kind of vagueness that
 * makes people assume the worst.
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
        {respawnCheckpoint === null
          ? 'RESPAWN AT THE START'
          : `RESPAWN AT CHECKPOINT ${respawnCheckpoint}`}
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

/** Why a run has no ranked time, in words a player can act on. */
const UNRANKED_MESSAGE: Record<SubmissionFailure, string> = {
  'not-signed-in': 'NOT RANKED · SIGN IN WITH WORLD APP TO SUBMIT TIMES',
  offline: 'NOT RANKED · COULD NOT REACH THE SERVER. YOUR TIME IS SAFE ON THIS DEVICE',
  rejected: 'NOT RANKED · THE SERVER COULD NOT VERIFY THIS RUN',
  'did-not-finish': 'NOT RANKED · THE SERVER DID NOT SEE THIS RUN REACH THE LINE',
  duplicate: 'NOT RANKED · THIS RUN HAS ALREADY BEEN SUBMITTED',
  'window-closed': 'NOT RANKED · TODAY’S RACE HAS CLOSED',
  closed: 'NOT RANKED · THIS RUN WAS CLOSED BEFORE IT WAS SENT. RIDE IT AGAIN TO RANK',
  'other-map': 'NOT RANKED · ONLY TODAY’S MAP HAS A LEADERBOARD',
};

/**
 * The same reasons, said BEFORE the race instead of after it.
 *
 * Whether a run can be ranked is known the moment the server does or does not issue it, so a player who is
 * about to ride for nothing is told while they can still do something about it. Finding out at the finish
 * line, after a personal best, is the version of this that makes people distrust the whole leaderboard.
 */
export const UNRANKED_WARNING: Record<SubmissionFailure, string> = {
  'not-signed-in': 'PRACTICE RUN · SIGN IN WITH WORLD APP TO RANK',
  offline: 'PRACTICE RUN · NO CONNECTION TO THE SERVER',
  rejected: 'PRACTICE RUN · THE SERVER DID NOT OPEN A RANKED RUN',
  'did-not-finish': 'PRACTICE RUN · THIS RUN WILL NOT BE RANKED',
  duplicate: 'PRACTICE RUN · THIS RUN WILL NOT BE RANKED',
  'window-closed': 'PRACTICE RUN · TODAY’S RACE HAS CLOSED',
  closed: 'PRACTICE RUN · THIS RUN WILL NOT BE RANKED',
  'other-map': 'PRACTICE RUN · ONLY TODAY’S MAP HAS A LEADERBOARD',
};

function VerificationNote({ verification }: { verification: Verification }) {
  if (verification.state === 'checking') {
    return <div className="pending-note notch">CHECKING YOUR RUN WITH THE SERVER…</div>;
  }
  if (verification.state === 'verified') {
    return (
      <div className="chip good notch verified-chip">
        <Icon name="check" />
        VERIFIED BY THE SERVER
      </div>
    );
  }
  if (verification.state === 'unranked') {
    return <div className="pending-note notch">{UNRANKED_MESSAGE[verification.reason]}</div>;
  }
  return <div className="pending-note notch">TIME NOT SUBMITTED</div>;
}

export type Verification =
  | { state: 'none' }
  | { state: 'checking' }
  | { state: 'verified'; time: SubmittedTime }
  | { state: 'unranked'; reason: SubmissionFailure };

export function FinishOverlay({
  map,
  ticks,
  splitTicks,
  isBest,
  previousBestTicks,
  verification,
  onRetry,
  onHome,
}: {
  map: MapEntry;
  ticks: number;
  splitTicks: readonly number[];
  isBest: boolean;
  previousBestTicks: number | null;
  verification: Verification;
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
          {verification.state === 'verified' && (
            <div className="row-kv notch">
              <span className="k">RANK</span>
              <span className="v green">
                #{verification.time.rank}{' '}
                <small style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {/* en-US, like every word around it: a Spanish phone would otherwise write 3.421. */}
                  / {verification.time.totalPlayers.toLocaleString('en-US')}
                </small>
              </span>
            </div>
          )}
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

        <VerificationNote verification={verification} />

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
