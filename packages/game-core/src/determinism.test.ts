import Box2DFactory from 'box2d3-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBikeSimulation } from './bike-sim';
import { INPUT } from './inputs';
import { SUNSET_CANYON } from './maps';
import { PHYSICS_ENGINE_OPTIONS, type PhysicsEngine } from './physics-engine';

/**
 * A golden record of the physics, pinned to exact floating-point values.
 *
 * ## Why this exists
 *
 * Phase 7's anti-cheat is: the player submits the inputs they pressed, the server re-simulates them, and a
 * submitted time is accepted only if the server arrives at the same result. That is worth nothing unless the
 * two machines agree exactly — and `box2d3-wasm` ships TWO separately compiled binaries, a SIMD "deluxe" one
 * that Node loads and a "compat" one the browser is pinned to (see `packages/game-client/physics-loader.ts`).
 * Nothing in the package promises those two agree.
 *
 * Measured on 2026-10-01 they do: this exact sequence was run in Node and in the browser and every sampled
 * value matched bit for bit, including through crashes and respawns. `apps/web/src/app/dev/determinism` is
 * the browser half of that comparison and can be re-run by hand at any time.
 *
 * ## What this test protects
 *
 * These numbers are not meaningful in themselves — they are a fingerprint. If a dependency upgrade, a
 * physics-tuning change or a different build of Box2D shifts the simulation by even one bit, this fails. For
 * a tuning change that is expected and the values should be updated deliberately; for a dependency bump it
 * is a warning that every stored replay and every leaderboard time just became unverifiable.
 */

let engine: PhysicsEngine;

beforeAll(async () => {
  engine = await Box2DFactory(PHYSICS_ENGINE_OPTIONS);
});

/** A fixed pattern that exercises throttle, both leans, braking, a crash and a respawn. */
function inputAt(tick: number): number {
  let mask: number = INPUT.GAS;
  if (tick % 97 < 30) mask |= INPUT.LEAN_BACK;
  if (tick % 131 < 20) mask |= INPUT.LEAN_FORWARD;
  if (tick % 211 < 12) mask |= INPUT.BRAKE;
  return mask;
}

/** Captured from the run that was verified against the browser binary. */
const EXPECTED = [
  { tick: 300, x: 31.025005340576172, y: 1.4243428707122803 },
  { tick: 600, x: 101.77336883544922, y: 1.7705341577529907 },
  { tick: 900, x: 12.857233047485352, y: 0.7212207317352295 },
  { tick: 1200, x: 0.06315352022647858, y: 0.6968387365341187 },
  { tick: 1500, x: 33.58598327636719, y: 1.6788405179977417 },
  { tick: 1800, x: 103.31587982177734, y: 1.9511064291000366 },
] as const;

describe('the simulation is reproducible to the bit', () => {
  it('replays a fixed input sequence to exactly the recorded positions', () => {
    const simulation = createBikeSimulation(engine, SUNSET_CANYON);
    const samples: { tick: number; x: number; y: number }[] = [];
    for (let tick = 0; tick < 1800; tick++) {
      simulation.step(inputAt(tick));
      if ((tick + 1) % 300 === 0) {
        const state = simulation.getState();
        samples.push({ tick: state.tick, x: state.x, y: state.y });
      }
    }
    simulation.dispose();

    // Exact equality, not a tolerance. A tolerance would pass a build whose results have drifted, which is
    // precisely the situation that silently invalidates every submitted replay.
    expect(samples).toEqual(EXPECTED.map((sample) => ({ ...sample })));
  });

  it('gives the same answer twice in the same process', () => {
    const run = (): number => {
      const simulation = createBikeSimulation(engine, SUNSET_CANYON);
      for (let tick = 0; tick < 600; tick++) simulation.step(inputAt(tick));
      const { x } = simulation.getState();
      simulation.dispose();
      return x;
    };
    // Two fresh worlds from one engine must not influence each other — a leak between them would show up as
    // a replay that verifies on a cold server and fails on a warm one.
    expect(Object.is(run(), run())).toBe(true);
  });
});
