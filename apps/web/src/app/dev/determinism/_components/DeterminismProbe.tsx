'use client';

import { useEffect, useState } from 'react';

/**
 * Runs the same fixed input sequence as `node-determinism` against the BROWSER's Box2D binary.
 *
 * The input pattern is duplicated here rather than imported from a shared helper on purpose: the point of
 * the exercise is that two independent runs of the same described sequence agree, and quietly sharing code
 * between them would hide a difference in how each side builds its inputs.
 */
function inputAt(tick: number, INPUT: Record<string, number>): number {
  let mask = INPUT.GAS!;
  if (tick % 97 < 30) mask |= INPUT.LEAN_BACK!;
  if (tick % 131 < 20) mask |= INPUT.LEAN_FORWARD!;
  if (tick % 211 < 12) mask |= INPUT.BRAKE!;
  return mask;
}

export function DeterminismProbe() {
  const [result, setResult] = useState<string>('running…');

  useEffect(() => {
    void (async () => {
      try {
        const [core, client] = await Promise.all([
          import('@worldrush/game-core'),
          import('@worldrush/game-client'),
        ]);
        const engine = await client.loadPhysicsEngine();
        const simulation = core.createBikeSimulation(engine, core.SUNSET_CANYON);
        const samples: unknown[] = [];
        for (let tick = 0; tick < 1800; tick++) {
          simulation.step(inputAt(tick, core.INPUT as unknown as Record<string, number>));
          if ((tick + 1) % 300 === 0) {
            const state = simulation.getState();
            samples.push({
              tick: state.tick,
              x: state.x,
              y: state.y,
              angle: state.angle,
              vx: state.vx,
            });
          }
        }
        const final = simulation.getState();
        simulation.dispose();
        setResult(
          JSON.stringify(
            {
              engine: 'browser (compat)',
              samples,
              final: {
                tick: final.tick,
                x: final.x,
                y: final.y,
                angle: final.angle,
                checkpointIndex: final.checkpointIndex,
                crashed: final.crashed,
              },
            },
            null,
            2,
          ),
        );
      } catch (error) {
        setResult(`failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
  }, []);

  return (
    <main style={{ padding: 16, fontFamily: 'monospace', fontSize: 12 }}>
      <h1 style={{ fontSize: 14 }}>D2a: browser physics determinism probe</h1>
      <pre id="determinism-result" style={{ whiteSpace: 'pre-wrap' }}>
        {result}
      </pre>
    </main>
  );
}
