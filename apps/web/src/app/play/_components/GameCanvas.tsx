'use client';

import { INPUT, type BikeState, type MapEntry } from '@worldrush/game-core';
import type { GameHandle } from '@worldrush/game-client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCountdown, millisecondsUntilNextRace, todaysMap } from '../../../lib/schedule';
import { dayKey, readBestTicks, recordRun } from '../../../lib/run-record';
import { runTimeParts } from '../../../lib/run-time';
import { Icon } from '../../_components/IconSprite';
import { CrashToast, FinishOverlay, PauseOverlay } from './RunOverlays';

/**
 * The gameplay screen, following control scheme A from `design/screens/gameplay-a.html`: the HUD along the
 * top (clear of the corner World App reserves for its own controls), the progress track under it, and four
 * pads in two thumb clusters.
 *
 * Everything the HUD shows is read from the simulation, which is also the run's clock — `finishTick` is the
 * submitted time, not anything measured against a wall clock.
 */

const PADS = [
  { flag: INPUT.LEAN_BACK, label: 'LEAN BACK', icon: 'lean-back', className: 'lean p-back' },
  { flag: INPUT.LEAN_FORWARD, label: 'LEAN FWD', icon: 'lean-fwd', className: 'lean p-fwd' },
  { flag: INPUT.BRAKE, label: 'BRAKE', icon: 'brake', className: 'brake p-brake' },
  { flag: INPUT.GAS, label: 'GAS', icon: 'gas', className: 'gas p-gas' },
] as const;

interface FinishSummary {
  readonly ticks: number;
  readonly splitTicks: readonly number[];
  readonly isBest: boolean;
  readonly previousBestTicks: number | null;
}

export function GameCanvas() {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const padRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const handleRef = useRef<GameHandle | null>(null);

  const [map, setMap] = useState<MapEntry | null>(null);
  const [state, setState] = useState<BikeState | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finish, setFinish] = useState<FinishSummary | null>(null);
  const [bestTicks, setBestTicks] = useState<number | null>(null);
  const [raceEndsIn, setRaceEndsIn] = useState('');

  // Per-run bookkeeping the simulation does not keep: how many times this run has crashed, and the tick each
  // checkpoint was reached at. Refs, not state, because they are written from the game loop every frame.
  const crashCountRef = useRef(0);
  const wasCrashedRef = useRef(false);
  const splitsRef = useRef<number[]>([]);
  const lastCheckpointRef = useRef(-1);
  const finishedRef = useRef(false);
  const [crashCount, setCrashCount] = useState(0);

  const resetRunBookkeeping = useCallback(() => {
    crashCountRef.current = 0;
    wasCrashedRef.current = false;
    splitsRef.current = [];
    lastCheckpointRef.current = -1;
    finishedRef.current = false;
    setCrashCount(0);
    setFinish(null);
  }, []);

  useEffect(() => {
    const parent = stageRef.current;
    if (!parent) return;

    const entry = todaysMap(new Date());
    setMap(entry);
    setBestTicks(readBestTicks(entry.level.id, dayKey(new Date())));

    let handle: GameHandle | null = null;
    let cancelled = false;

    const onState = (next: BikeState): void => {
      // Crash count: rising edge only, or it would tick up every frame the bike lies on its side.
      if (next.crashed && !wasCrashedRef.current) {
        crashCountRef.current += 1;
        setCrashCount(crashCountRef.current);
      }
      wasCrashedRef.current = next.crashed;

      if (next.checkpointIndex > lastCheckpointRef.current) {
        lastCheckpointRef.current = next.checkpointIndex;
        splitsRef.current = [...splitsRef.current, next.tick];
      }

      if (next.finished && !finishedRef.current) {
        finishedRef.current = true;
        const ticks = next.finishTick ?? next.tick;
        const result = recordRun(entry.level.id, dayKey(new Date()), ticks);
        setFinish({ ticks, splitTicks: splitsRef.current, ...result });
        setBestTicks(result.isBest ? ticks : result.previousBestTicks);
        handleRef.current?.pause();
      }

      setState(next);
    };

    // Imported here rather than at module scope: PixiJS and the Box2D WASM module are browser-only, so
    // loading them during the server render would fail.
    void (async () => {
      try {
        const { startGame } = await import('@worldrush/game-client');
        if (cancelled) return;
        handle = await startGame({ parent, level: entry.level, onState });
        if (cancelled) {
          handle.destroy();
          handle = null;
          return;
        }
        handleRef.current = handle;
        PADS.forEach((pad, index) => {
          const element = padRefs.current[index];
          if (element) handle?.bindButton(element, pad.flag);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The game engine failed to load.');
      }
    })();

    return () => {
      cancelled = true;
      handle?.destroy();
      handle = null;
      handleRef.current = null;
    };
  }, []);

  // The daily deadline, for the pause screen. Only ticks while paused — there is no reason to re-render the
  // whole screen once a second while someone is riding.
  useEffect(() => {
    if (!paused) return;
    const update = () => setRaceEndsIn(formatCountdown(millisecondsUntilNextRace(new Date())));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [paused]);

  const pause = useCallback(() => {
    handleRef.current?.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    handleRef.current?.resume();
    setPaused(false);
  }, []);

  const restart = useCallback(() => {
    resetRunBookkeeping();
    handleRef.current?.restart();
    setPaused(false);
  }, [resetRunBookkeeping]);

  const quit = useCallback(() => router.push('/'), [router]);

  const time = runTimeParts(state?.finishTick ?? state?.tick ?? 0);
  const checkpointCount = map?.level.checkpoints.length ?? 0;
  const reached = (state?.checkpointIndex ?? -1) + 1;
  const progress = map ? runProgress(state, map) : 0;

  return (
    <div className="game-screen">
      <div className="game-stage" ref={stageRef} />

      <div className="hud-top">
        <button
          className="round-btn notch"
          type="button"
          onClick={pause}
          aria-label="Pause"
          disabled={paused || finish !== null}
        >
          <Icon name="pause" className="i" />
        </button>
        <div>
          <div className="timer notch">
            <div className="l">{state?.crashed ? 'TIME · STILL RUNNING' : 'TIME'}</div>
            <div className="t">
              {time.clock}
              <small>{time.millis}</small>
            </div>
          </div>
          <div className="hud-sub">
            {crashCount > 0 ? (
              <span className="chip bad notch">CRASH ×{crashCount}</span>
            ) : (
              <span className="chip notch">CP {reached}</span>
            )}
            <span className="cp-pips">
              {Array.from({ length: checkpointCount }, (_, index) => (
                <span
                  key={index}
                  className={
                    index < reached ? 'pip done notch' : index === reached ? 'pip next notch' : 'pip notch'
                  }
                >
                  {index < reached && <Icon name="check" className="i" />}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>

      <div className="track notch">
        <div className="fill" style={{ width: `${progress}%` }} />
        {map?.level.checkpoints.map((checkpoint) => (
          <i key={checkpoint} className="mk" style={{ left: `${checkpointPosition(checkpoint, map)}%` }} />
        ))}
        <i className="me" style={{ left: `${progress}%` }} />
        <i className="goal" />
      </div>

      <div className="pads-a">
        <div className="pad-cluster">
          {PADS.slice(0, 2).map((pad, index) => (
            <PadButton key={pad.label} pad={pad} index={index} padRefs={padRefs} />
          ))}
        </div>
        <div className="pad-cluster">
          {PADS.slice(2).map((pad, index) => (
            <PadButton key={pad.label} pad={pad} index={index + 2} padRefs={padRefs} />
          ))}
        </div>
      </div>

      {state?.crashed && !paused && finish === null && (
        <CrashToast
          crashedTicksAgo={state.crashedTicksAgo}
          respawnCheckpoint={state.checkpointIndex >= 0 ? state.checkpointIndex + 1 : null}
        />
      )}

      {paused && map && (
        <PauseOverlay
          map={map}
          ticks={state?.tick ?? 0}
          bestTicks={bestTicks}
          raceEndsIn={raceEndsIn}
          onResume={resume}
          onRestart={restart}
          onQuit={quit}
        />
      )}

      {finish && map && (
        <FinishOverlay
          map={map}
          ticks={finish.ticks}
          splitTicks={finish.splitTicks}
          isBest={finish.isBest}
          previousBestTicks={finish.previousBestTicks}
          onRetry={restart}
          onHome={quit}
        />
      )}

      {error && (
        <p className="game-error notch" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function PadButton({
  pad,
  index,
  padRefs,
}: {
  pad: (typeof PADS)[number];
  index: number;
  padRefs: React.RefObject<(HTMLButtonElement | null)[]>;
}) {
  return (
    <button
      type="button"
      className={`pad ${pad.className} notch`}
      aria-label={pad.label}
      ref={(element) => {
        padRefs.current[index] = element;
      }}
    >
      <Icon name={pad.icon} className="i" />
      <span>{pad.label}</span>
    </button>
  );
}

/** How far along the track the rider is, 0-100, for the progress bar. */
function runProgress(state: BikeState | null, map: MapEntry): number {
  if (!state) return 0;
  return clampPercent(state.x, map);
}

function checkpointPosition(checkpoint: number, map: MapEntry): number {
  return clampPercent(checkpoint, map);
}

function clampPercent(x: number, map: MapEntry): number {
  const start = map.level.start.x;
  const span = map.level.finishX - start;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((x - start) / span) * 100));
}
