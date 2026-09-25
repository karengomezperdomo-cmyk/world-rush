'use client';

import { INPUT, TICK_SECONDS, type BikeState } from '@worldrush/game-core';
import type { GameHandle } from '@worldrush/game-client';
import { useEffect, useRef, useState } from 'react';

/**
 * Phase 5 spike harness: mounts the physics prototype and lays the control pads out in the decided
 * scheme A arrangement (design/screens/gameplay-a.html) — functional, not the finished art.
 */

const PADS = [
  { flag: INPUT.LEAN_BACK, label: 'LEAN BACK', className: 'pad-lean' },
  { flag: INPUT.LEAN_FORWARD, label: 'LEAN FWD', className: 'pad-lean' },
  { flag: INPUT.BRAKE, label: 'BRAKE', className: 'pad-brake' },
  { flag: INPUT.GAS, label: 'GAS', className: 'pad-gas' },
] as const;

function formatTime(tick: number): string {
  const seconds = tick * TICK_SECONDS;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
}

export function GameCanvas() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const padRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [state, setState] = useState<BikeState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parent = stageRef.current;
    if (!parent) return;

    let handle: GameHandle | null = null;
    let cancelled = false;

    // Imported here rather than at module scope: PixiJS and the Box2D WASM module are browser-only, so
    // loading them during the server render would fail.
    void (async () => {
      try {
        const [{ startGame }, { TEST_LEVEL }] = await Promise.all([
          import('@worldrush/game-client'),
          import('@worldrush/game-core'),
        ]);
        if (cancelled) return;
        handle = await startGame({ parent, level: TEST_LEVEL, onState: setState });
        if (cancelled) {
          handle.destroy();
          handle = null;
          return;
        }
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
    };
  }, []);

  return (
    <div className="game-screen">
      <div className="game-stage" ref={stageRef} />

      <div className="game-hud">
        <span className="hud-time">{state ? formatTime(state.tick) : '0:00.00'}</span>
        <span className="hud-chip">CP {state ? state.checkpointIndex + 1 : 0}</span>
        {state?.crashed && <span className="hud-chip hud-crashed">CRASHED</span>}
        {state?.finished && <span className="hud-chip hud-finished">FINISHED</span>}
      </div>

      {error && (
        <p className="game-error" role="alert">
          {error}
        </p>
      )}

      <div className="game-pads">
        <div className="pad-group">
          {PADS.slice(0, 2).map((pad, index) => (
            <button
              key={pad.label}
              type="button"
              className={`pad ${pad.className}`}
              ref={(element) => {
                padRefs.current[index] = element;
              }}
            >
              {pad.label}
            </button>
          ))}
        </div>
        <div className="pad-group">
          {PADS.slice(2).map((pad, index) => (
            <button
              key={pad.label}
              type="button"
              className={`pad ${pad.className}`}
              ref={(element) => {
                padRefs.current[index + 2] = element;
              }}
            >
              {pad.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
