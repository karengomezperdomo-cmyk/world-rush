import Box2DFactory from 'box2d3-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBikeSimulation, type BikeSimulation } from './bike-sim';
import { INPUT, type InputMask } from './inputs';
import { TEST_LEVEL } from './level';
import { PHYSICS_ENGINE_OPTIONS, type PhysicsEngine } from './physics-engine';

let engine: PhysicsEngine;

beforeAll(async () => {
  // Node gets the "deluxe" (SIMD) binary from the package's own entry point; the browser is served "compat"
  // instead (see `physics-engine.ts` — the two are not guaranteed to agree bit for bit).
  engine = await Box2DFactory(PHYSICS_ENGINE_OPTIONS);
});

function run(sim: BikeSimulation, inputs: readonly InputMask[]): void {
  for (const input of inputs) sim.step(input);
}

/** Holds GAS for `ticks` ticks, then coasts (no input) for `coast` more. */
function gasThenCoast(ticks: number, coast = 0): InputMask[] {
  return [...Array<InputMask>(ticks).fill(INPUT.GAS), ...Array<InputMask>(coast).fill(0)];
}

describe('createBikeSimulation determinism', () => {
  it('produces byte-identical state from a fresh world given the same input sequence', () => {
    const inputs = [...gasThenCoast(40), INPUT.LEAN_FORWARD, ...gasThenCoast(120)];

    const simA = createBikeSimulation(engine, TEST_LEVEL);
    run(simA, inputs);
    const stateA = simA.getState();
    simA.dispose();

    const simB = createBikeSimulation(engine, TEST_LEVEL);
    run(simB, inputs);
    const stateB = simB.getState();
    simB.dispose();

    expect(stateB).toEqual(stateA);
  });
});

describe('createBikeSimulation physics sanity', () => {
  it('settles under gravity near the start when given no input', () => {
    const sim = createBikeSimulation(engine, TEST_LEVEL);
    run(sim, Array<InputMask>(90).fill(0));
    const state = sim.getState();
    sim.dispose();
    expect(state.crashed).toBe(false);
    expect(Math.abs(state.x - TEST_LEVEL.start.x)).toBeLessThan(1.5);
    expect(state.y).toBeGreaterThan(-1);
  });

  it('moves forward (increasing x) while GAS is held on flat ground', () => {
    const sim = createBikeSimulation(engine, TEST_LEVEL);
    run(sim, Array<InputMask>(30).fill(0)); // let it settle first
    const settledX = sim.getState().x;
    run(sim, gasThenCoast(150));
    const state = sim.getState();
    sim.dispose();
    expect(state.crashed).toBe(false);
    expect(state.x).toBeGreaterThan(settledX + 2);
  });

  it('reaches the first checkpoint after enough GAS', () => {
    const sim = createBikeSimulation(engine, TEST_LEVEL);
    run(sim, Array<InputMask>(30).fill(0));
    run(sim, gasThenCoast(260));
    const state = sim.getState();
    sim.dispose();
    expect(state.crashed).toBe(false);
    expect(state.checkpointIndex).toBeGreaterThanOrEqual(0);
    expect(state.x).toBeGreaterThanOrEqual(TEST_LEVEL.checkpoints[0] ?? Infinity);
  });

  it('tipping over while airborne crashes, and auto-respawns near the last checkpoint', () => {
    const sim = createBikeSimulation(engine, TEST_LEVEL);
    // Enough throttle to clear the first checkpoint and launch off the takeoff ramp.
    run(sim, Array<InputMask>(30).fill(0));
    run(sim, gasThenCoast(260));
    const afterRamp = sim.getState();
    expect(afterRamp.crashed).toBe(false);
    expect(afterRamp.checkpointIndex).toBe(0);

    // Force a nose-dive while airborne over the gap: with no ground contact to resist it, LEAN_FORWARD
    // reliably tips the chassis past the crash threshold regardless of exact drive-torque tuning (unlike
    // trying to under-power the jump itself, which this level's ramp turns out to clear surprisingly easily).
    let state = afterRamp;
    for (let i = 0; i < 60 && !state.crashed; i++) {
      sim.step(INPUT.LEAN_FORWARD);
      state = sim.getState();
    }
    expect(state.crashed).toBe(true);

    // Keep stepping through the fixed respawn delay.
    run(sim, Array<InputMask>(90).fill(0));
    const respawned = sim.getState();
    sim.dispose();
    expect(respawned.crashed).toBe(false);
    expect(Math.abs(respawned.x - (TEST_LEVEL.checkpoints[0] ?? 0))).toBeLessThan(2);
  });
});
