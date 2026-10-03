'use client';

import {
  INPUT,
  mapByNumber,
  TICK_SECONDS,
  type BikeState,
  type MapEntry,
} from '@worldrush/game-core';
import type { GameAudio, GameHandle } from '@worldrush/game-client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hapticCheckpoint, hapticCrash, hapticFinish } from '../../../lib/haptics';
import {
  ALL_MAPS_OPEN_FOR_TESTING,
  formatCountdown,
  millisecondsUntilNextRace,
  todaysMap,
} from '../../../lib/schedule';
import { readSettings, SETTINGS_CHANGED_EVENT, type Settings } from '../../../lib/settings';
import { startRun as openRun, submitReplay, type SubmissionFailure } from '../../../lib/submission';
import { dayKey, readBestTicks, recordRun } from '../../../lib/run-record';
import { runTimeParts } from '../../../lib/run-time';
import { Icon } from '../../_components/IconSprite';
import {
  CrashToast,
  FinishOverlay,
  PauseOverlay,
  UNRANKED_WARNING,
  type Verification,
} from './RunOverlays';

/**
 * The gameplay screen, following control scheme A from `design/screens/gameplay-a.html`: the HUD along the
 * top (clear of the corner World App reserves for its own controls), the progress track under it, and four
 * pads in two thumb clusters.
 *
 * Everything the HUD shows is read from the simulation, which is also the run's clock — `finishTick` is the
 * submitted time, not anything measured against a wall clock.
 */

/**
 * The pads show PICTURES of what they do — a fuel can, a brake disc, and the bike itself tilted the way the
 * pad tilts it — rather than the generic stroke symbols they started with (two chevrons, a filled square,
 * circular arrows), which said nothing about a motorbike.
 */
const PADS = [
  { flag: INPUT.LEAN_BACK, label: 'LEAN BACK', art: 'lean-back', className: 'lean p-back' },
  { flag: INPUT.LEAN_FORWARD, label: 'LEAN FWD', art: 'lean-forward', className: 'lean p-fwd' },
  { flag: INPUT.BRAKE, label: 'BRAKE', art: 'brake', className: 'brake p-brake' },
  { flag: INPUT.GAS, label: 'GAS', art: 'gas', className: 'gas p-gas' },
] as const;

interface FinishSummary {
  readonly ticks: number;
  readonly splitTicks: readonly number[];
  readonly isBest: boolean;
  readonly previousBestTicks: number | null;
}

/**
 * `/play?map=5` loads that map instead of today's.
 *
 * Allowed in development always, and in any build while `ALL_MAPS_OPEN_FOR_TESTING` is on — which is the
 * point of that flag: six of the seven maps are otherwise unreachable on a given day, so they cannot be
 * played or judged. Turning the flag off restores the daily rotation here and on the menu together.
 */
function requestedMap(): MapEntry | undefined {
  if (!ALL_MAPS_OPEN_FOR_TESTING && process.env.NODE_ENV !== 'development') return undefined;
  const requested = Number(new URLSearchParams(window.location.search).get('map'));
  return Number.isInteger(requested) ? mapByNumber(requested) : undefined;
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
  const [verification, setVerification] = useState<Verification>({ state: 'none' });
  /** The server-issued run this attempt belongs to. Null when playing unranked. */
  const runIdRef = useRef<string | null>(null);
  /**
   * Why this attempt is not ranked, known from the moment the server declined to open a run.
   *
   * Kept twice on purpose: the ref is read from the finish handler, which runs inside the game loop's
   * callback and must not depend on a re-render having happened, and the state drives the warning the
   * player sees while riding.
   */
  const unrankedRef = useRef<SubmissionFailure | null>(null);
  const [unranked, setUnranked] = useState<SubmissionFailure | null>(null);
  const noteUnranked = useCallback((reason: SubmissionFailure | null) => {
    unrankedRef.current = reason;
    setUnranked(reason);
  }, []);

  /**
   * Opens a run for the map actually on screen, and returns its id — or null, having recorded why not.
   *
   * The map check is not paranoia. `ALL_MAPS_OPEN_FOR_TESTING` lets any of the seven be played, but a
   * competition only ever runs today's, so a run issued while map 1 is on screen on a Saturday is rejected
   * as `wrong_map` after two minutes of riding. The mismatch is visible before the race, so it is said then.
   */
  const openRunFor = useCallback(
    async (levelId: string): Promise<string | null> => {
      const issued = await openRun();
      if (!issued.ok) {
        noteUnranked(issued.reason);
        return null;
      }
      if (issued.run.mapSlug !== levelId) {
        noteUnranked('other-map');
        return null;
      }
      noteUnranked(null);
      return issued.run.runId;
    },
    [noteUnranked],
  );

  // Per-run bookkeeping the simulation does not keep: how many times this run has crashed, and the tick each
  // checkpoint was reached at. Refs, not state, because they are written from the game loop every frame.
  const crashCountRef = useRef(0);
  const wasCrashedRef = useRef(false);
  const splitsRef = useRef<number[]>([]);
  const lastCheckpointRef = useRef(-1);
  const finishedRef = useRef(false);
  const [crashCount, setCrashCount] = useState(0);
  const audioRef = useRef<GameAudio | null>(null);
  // Read from the game loop every frame, so it must be a ref rather than state.
  const settingsRef = useRef<Settings>(readSettings());
  const [swapSides, setSwapSides] = useState(false);

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
    const apply = (next: Settings) => {
      settingsRef.current = next;
      setSwapSides(next.swapSides);
      audioRef.current?.setSoundEffects(next.soundEffects);
      audioRef.current?.setMusic(next.music);
    };
    apply(readSettings());
    const onChange = (event: Event) => apply((event as CustomEvent<Settings>).detail);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onChange);
  }, []);

  /**
   * Sends the recorded inputs and waits for the server's verdict.
   *
   * Deliberately not awaited by the caller: the finish screen appears immediately with the local time, and
   * the rank fills in when the answer arrives. Making the player stare at a spinner before seeing their own
   * run would be a worse trade than a line that updates a moment later.
   */
  const submitFinishedRun = useCallback(async (finishTick: number) => {
    const runId = runIdRef.current;
    const replay = handleRef.current?.getReplay() ?? null;
    if (!runId || !replay) {
      // The reason was established when the run was opened. Guessing "not signed in" here was wrong for
      // every other cause, and told a signed-in player with a network problem to go and sign in.
      setVerification({ state: 'unranked', reason: unrankedRef.current ?? 'rejected' });
      return;
    }
    setVerification({ state: 'checking' });
    const claimedMs = Math.round(finishTick * TICK_SECONDS * 1000);
    const outcome = await submitReplay(runId, replay, claimedMs);
    setVerification(
      outcome.ok
        ? { state: 'verified', time: outcome.time }
        : { state: 'unranked', reason: outcome.reason },
    );
    // A run id is good for one submission, so a retry needs a new one.
    runIdRef.current = null;
  }, []);

  useEffect(() => {
    const parent = stageRef.current;
    if (!parent) return;

    const entry = requestedMap() ?? todaysMap(new Date());
    setMap(entry);
    setBestTicks(readBestTicks(entry.level.id, dayKey(new Date())));

    let handle: GameHandle | null = null;
    let cancelled = false;

    const onState = (next: BikeState): void => {
      // Crash count: rising edge only, or it would tick up every frame the bike lies on its side.
      if (next.crashed && !wasCrashedRef.current) {
        crashCountRef.current += 1;
        setCrashCount(crashCountRef.current);
        audioRef.current?.crash();
        if (settingsRef.current.vibration) hapticCrash();
      }
      wasCrashedRef.current = next.crashed;

      if (next.checkpointIndex > lastCheckpointRef.current) {
        lastCheckpointRef.current = next.checkpointIndex;
        splitsRef.current = [...splitsRef.current, next.tick];
        audioRef.current?.checkpoint();
        if (settingsRef.current.vibration) hapticCheckpoint();
      }

      audioRef.current?.engine(next.vx ?? 0, !next.crashed && !next.finished);

      if (next.finished && !finishedRef.current) {
        finishedRef.current = true;
        void submitFinishedRun(next.finishTick ?? next.tick);
        audioRef.current?.finish();
        if (settingsRef.current.vibration) hapticFinish();
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
        // Asking for a run and loading the engine are independent, so they overlap. A refused run is not an
        // error: the game still plays, it just will not be ranked.
        const [{ startGame, createGameAudio }, issued] = await Promise.all([
          import('@worldrush/game-client'),
          openRunFor(entry.level.id),
        ]);
        if (cancelled) return;
        runIdRef.current = issued;
        const settings = settingsRef.current;
        audioRef.current = createGameAudio({
          soundEffects: settings.soundEffects,
          music: settings.music,
        });
        // Always recorded, even when this attempt cannot be ranked. The recorder costs a few bytes per
        // input change, and a retry opens a NEW run — which may well succeed where the first one failed, and
        // would then have had nothing to submit. Whether a replay is SENT is decided by the run id, not here.
        handle = await startGame({ parent, level: entry.level, onState, record: true });
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
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, [openRunFor, submitFinishedRun]);

  // The daily deadline, for the pause screen. Only ticks while paused — there is no reason to re-render the
  // whole screen once a second while someone is riding.
  useEffect(() => {
    if (!paused) return;
    const update = () => setRaceEndsIn(formatCountdown(millisecondsUntilNextRace(new Date())));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [paused]);

  const unlockAudio = useCallback(() => audioRef.current?.resume(), []);

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
    setVerification({ state: 'none' });
    handleRef.current?.restart();
    setPaused(false);
    // The spent run id cannot be reused, so the retry gets its own — and plays unranked if none is issued.
    if (map) void openRunFor(map.level.id).then((runId) => (runIdRef.current = runId));
  }, [map, openRunFor, resetRunBookkeeping]);

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
                    index < reached
                      ? 'pip done notch'
                      : index === reached
                        ? 'pip next notch'
                        : 'pip notch'
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
          <i
            key={checkpoint}
            className="mk"
            style={{ left: `${checkpointPosition(checkpoint, map)}%` }}
          />
        ))}
        <i className="me" style={{ left: `${progress}%` }} />
        <i className="goal" />
      </div>

      {/* Said before the race, not after it: the server either opened a ranked run or it did not, and the
          player deserves to know which while they can still do something about it. */}
      {unranked !== null && finish === null && (
        <p className="unranked-warning notch" role="status">
          {UNRANKED_WARNING[unranked]}
        </p>
      )}

      {/* "Swap sides" mirrors the two clusters, so gas and brake fall under the left thumb. */}
      <div className={swapSides ? 'pads-a swapped' : 'pads-a'} onPointerDown={unlockAudio}>
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
          verification={verification}
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
      {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, must not be resampled */}
      <img className="pad-art pix" src={`/art/controls/${pad.art}.png`} alt="" />
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
