'use client';

import { CRASH_RESPAWN_TICKS, type MapEntry } from '@worldrush/game-core';
import { mapNameKey } from '../../../lib/i18n/map-text';
import type { MessageKey } from '../../../lib/i18n/messages';
import { useTranslation } from '../../../lib/i18n/provider';
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
  const { t } = useTranslation();
  return (
    <>
      <div className="scrim heavy" />
      <div className="modal modal-centre notch" role="dialog" aria-modal="true" aria-label="Paused">
        <div className="eyebrow">
          {t('home.map', { number: map.number })} · {t(mapNameKey(map))}
        </div>
        <div className="banner" style={{ margin: '10px 0 16px' }}>
          {t('game.paused')}
        </div>
        <div className="stack">
          <div className="row-kv notch">
            <span className="k">{t('game.time')}</span>
            <span className="v">{formatRunTime(ticks)}</span>
          </div>
          {bestTicks !== null && (
            <div className="row-kv notch">
              <span className="k">{t('game.yourBestToday')}</span>
              <span className="v gold">{formatRunTime(bestTicks)}</span>
            </div>
          )}
        </div>
        <div className="stack" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" type="button" onClick={onResume}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <use href="#play" />
            </svg>
            {t('game.resume')}
          </button>
          <button className="btn btn-secondary notch" type="button" onClick={onRestart}>
            <Icon name="refresh" className="i" />
            {t('game.restart')}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onQuit}>
            {t('game.quit')}
          </button>
        </div>
        {/* The run's clock is the simulation's, so pausing really does stop it. The DAILY deadline does not,
            and the player has to know that before they decide to sit here. */}
        <p className="hint" style={{ marginTop: 12 }}>
          {t('game.pauseNote')}
          <br />
          {t('game.raceEndsIn')} <b style={{ color: 'var(--text)' }}>{raceEndsIn}</b>
        </p>
      </div>
    </>
  );
}

/**
 * What the rider sees when the tank runs dry.
 *
 * The run clock is the simulation's own tick count, and the simulation is paused while this is open, so
 * reading it costs nothing — which is the whole reason a decision can be offered here at all. The screen
 * says so out loud, because a timer that has visibly stopped still looks like a trap.
 *
 * Two free continues, then each one adds seconds to the time. The cost is applied by the SERVER, from a
 * continue count it reaches by re-simulating the replay, so what this screen promises is what gets
 * charged.
 */
export function OutOfFuelOverlay({
  map,
  ticks,
  checkpoint,
  continuesUsed,
  freeContinues,
  penaltySeconds,
  onContinue,
  onRestart,
  onQuit,
}: {
  map: MapEntry;
  ticks: number;
  checkpoint: number | null;
  continuesUsed: number;
  freeContinues: number;
  penaltySeconds: number;
  onContinue: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  const { t } = useTranslation();
  const freeLeft = Math.max(0, freeContinues - continuesUsed);
  return (
    <>
      <div className="scrim heavy" />
      <div
        className="modal modal-centre notch"
        role="dialog"
        aria-modal="true"
        aria-label={t('game.outOfFuel')}
      >
        <div className="eyebrow">
          {t('home.map', { number: map.number })} · {t(mapNameKey(map))}
        </div>
        <div className="banner" style={{ margin: '10px 0 6px' }}>
          {t('game.outOfFuel')}
        </div>
        <p className="hint" style={{ marginBottom: 14 }}>
          {t('game.outOfFuelDetail')}
        </p>
        <div className="stack">
          <div className="row-kv notch">
            <span className="k">{t('game.time')}</span>
            <span className="v">{formatRunTime(ticks)}</span>
          </div>
        </div>
        <div className="stack" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" type="button" onClick={onContinue}>
            {freeLeft === 0
              ? t('game.continueCost', { seconds: penaltySeconds })
              : checkpoint === null || checkpoint < 0
                ? t('game.continueFromStart')
                : t('game.continueFree', { number: checkpoint + 1 })}
          </button>
          {freeLeft > 0 && (
            <p className="hint" style={{ margin: '2px 0 6px' }}>
              {t('game.continueFreeLeft', { count: freeLeft })}
            </p>
          )}
          <button className="btn btn-secondary notch" type="button" onClick={onRestart}>
            <Icon name="refresh" className="i" />
            {t('game.startOver')}
          </button>
          <p className="hint" style={{ margin: '2px 0 6px' }}>
            {t('game.startOverDetail')}
          </p>
          <button className="btn btn-ghost" type="button" onClick={onQuit}>
            {t('game.quit')}
          </button>
        </div>
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
  const { t } = useTranslation();
  const progress = Math.min(100, (crashedTicksAgo / CRASH_RESPAWN_TICKS) * 100);
  return (
    <div className="toast notch" role="status">
      <div className="h">{t('game.crash')}</div>
      <div className="p">
        {respawnCheckpoint === null
          ? t('game.respawnStart')
          : t('game.respawnCheckpoint', { number: respawnCheckpoint })}
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
        {t('game.clockKeepsRunning')}
      </div>
    </div>
  );
}

/** Why a run has no ranked time, in words a player can act on. */
const UNRANKED_MESSAGE: Record<SubmissionFailure, MessageKey> = {
  'not-signed-in': 'unranked.notSignedIn',
  offline: 'unranked.offline',
  rejected: 'unranked.rejected',
  'did-not-finish': 'unranked.didNotFinish',
  duplicate: 'unranked.duplicate',
  'window-closed': 'unranked.windowClosed',
  closed: 'unranked.closed',
  'other-map': 'unranked.otherMap',
};

/**
 * The same reasons, said BEFORE the race instead of after it.
 *
 * Whether a run can be ranked is known the moment the server does or does not issue it, so a player who is
 * about to ride for nothing is told while they can still do something about it. Finding out at the finish
 * line, after a personal best, is the version of this that makes people distrust the whole leaderboard.
 */
export const UNRANKED_WARNING: Record<SubmissionFailure, MessageKey> = {
  'not-signed-in': 'warning.notSignedIn',
  offline: 'warning.offline',
  rejected: 'warning.rejected',
  'did-not-finish': 'warning.generic',
  duplicate: 'warning.generic',
  'window-closed': 'warning.windowClosed',
  closed: 'warning.generic',
  'other-map': 'warning.otherMap',
};

function VerificationNote({ verification }: { verification: Verification }) {
  const { t } = useTranslation();
  if (verification.state === 'checking') {
    return <div className="pending-note notch">{t('game.checking')}</div>;
  }
  if (verification.state === 'verified') {
    return (
      <div className="chip good notch verified-chip">
        <Icon name="check" />
        {t('game.verified')}
      </div>
    );
  }
  if (verification.state === 'unranked') {
    return <div className="pending-note notch">{t(UNRANKED_MESSAGE[verification.reason])}</div>;
  }
  return <div className="pending-note notch">{t('game.notSubmitted')}</div>;
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
  const { t } = useTranslation();
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
          {t('home.map', { number: map.number })} · {t(mapNameKey(map))}
        </div>
        <div className="banner gold" style={{ margin: '8px 0 4px' }}>
          {t('game.finish')}
        </div>
        <div className="hint" style={{ marginBottom: 8 }}>
          {t('game.yourTime')}
        </div>
        <Time ticks={ticks} className="big-time" />

        {isBest && previousBestTicks !== null && (
          <div className="ribbon" style={{ margin: '12px 4px 10px' }}>
            <Icon name="crown" />
            {t('game.newPersonalBest', { delta: formatDelta(ticks - previousBestTicks) })}
          </div>
        )}

        <div className="stack" style={{ gap: 6 }}>
          <div className="row-kv notch">
            <span className="k">{t('game.bestOnThisDevice')}</span>
            <span className="v gold">{formatRunTime(bestTicks)}</span>
          </div>
          {verification.state === 'verified' && (
            <div className="row-kv notch">
              <span className="k">{t('game.rank')}</span>
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
                <span>{t('game.checkpointChip', { number: index + 1 })}</span>
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
            {t('common.tryAgain')}
          </button>
          <button className="btn btn-ghost" type="button" style={{ height: 30 }} onClick={onHome}>
            {t('common.backToHome')}
          </button>
        </div>
      </div>
    </>
  );
}
