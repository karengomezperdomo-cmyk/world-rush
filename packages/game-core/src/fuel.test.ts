import Box2DFactory from 'box2d3-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBikeSimulation, DEFAULT_TANK_SECONDS, type BikeState } from './bike-sim';
import { INPUT } from './inputs';
import { defineLevel, type Level } from './level';
import { PHYSICS_ENGINE_OPTIONS, type PhysicsEngine } from './physics-engine';

/**
 * The tank.
 *
 * Fuel is the first thing in this game that makes the fast line a choice rather than the only line, so what
 * these tests pin down is the economics of it: throttle costs, nothing else does, a can is worth what it
 * says and can only be taken once, and an empty tank kills the engine without ending the run.
 */

let engine: PhysicsEngine;

beforeAll(async () => {
  engine = await Box2DFactory(PHYSICS_ENGINE_OPTIONS);
});

/**
 * A flat track far longer than a tank, so fuel is the only thing that can end the ride.
 *
 * The first draft finished at 380 m, which the bike reaches in about 25 seconds at full throttle - so the
 * run was over long before the tank was, and three tests failed with fuel left in it. The track has to
 * outlast the tank for any of this to be measurable.
 */
function flatLevel(fuelCans?: Level['fuelCans']): Level {
  return defineLevel({
    id: 'fuel-test',
    ground: [
      [
        [-10, 0],
        [6000, 0],
      ],
    ],
    start: { x: 0, y: 0.6 },
    checkpoints: [120, 240],
    finishX: 5900,
    killY: -10,
    fuelCans,
  });
}

function run(
  level: Level,
  ticks: number,
  input: (tick: number, state: BikeState) => number,
): BikeState {
  const simulation = createBikeSimulation(engine, level);
  for (let tick = 0; tick < ticks; tick++) {
    simulation.step(input(tick, simulation.getState()));
  }
  const final = simulation.getState();
  simulation.dispose();
  return final;
}

describe('burning fuel', () => {
  it('starts with a full tank', () => {
    const state = run(flatLevel(), 1, () => 0);
    expect(state.fuel).toBe(DEFAULT_TANK_SECONDS);
    expect(state.outOfFuel).toBe(false);
  });

  it('burns a second of fuel for a second of throttle', () => {
    const state = run(flatLevel(), 60, () => INPUT.GAS);
    expect(state.fuel).toBeCloseTo(DEFAULT_TANK_SECONDS - 1, 5);
  });

  it('charges nothing for coasting, braking or leaning', () => {
    const state = run(flatLevel(), 120, () => INPUT.BRAKE | INPUT.LEAN_BACK);
    expect(state.fuel).toBe(DEFAULT_TANK_SECONDS);
  });

  it('kills the engine at zero and leaves the run going', () => {
    // Hold the throttle for longer than the tank lasts.
    const ticks = (DEFAULT_TANK_SECONDS + 5) * 60;
    const state = run(flatLevel(), ticks, () => INPUT.GAS);
    expect(state.fuel).toBe(0);
    expect(state.outOfFuel).toBe(true);
    // Not a crash and not a finish: the bike simply has no drive any more.
    expect(state.crashed).toBe(false);
    expect(state.finished).toBe(false);
  });
});

describe('petrol cans', () => {
  // Far enough down the track that the tank has room for the whole can by the time it is reached. Put it
  // at 40 m and the tank is still nearly full, the cap swallows most of the refill, and the test ends up
  // measuring the ceiling instead of the can.
  const cans = [{ x: 400, y: 0.6, refill: 8 }];

  it('refills when the bike rides through one, and only once', () => {
    const level = flatLevel(cans);
    const simulation = createBikeSimulation(engine, level);
    let seenFull = 0;
    for (let tick = 0; tick < 60 * 30; tick++) {
      simulation.step(INPUT.GAS);
      if (simulation.getState().takenCans !== 0) seenFull += 1;
    }
    const state = simulation.getState();
    simulation.dispose();

    expect(state.takenCans).toBe(0b1);
    expect(seenFull).toBeGreaterThan(0);
    // Burned 30 s of throttle and picked up 8 s: a can taken twice would show as 8 more.
    expect(state.fuel).toBeCloseTo(DEFAULT_TANK_SECONDS - 30 + 8, 1);
  });

  it('can be missed: a can off the line is not collected by passing underneath it', () => {
    const level = flatLevel([{ x: 40, y: 6, refill: 8 }]);
    const state = run(level, 60 * 20, () => INPUT.GAS);
    expect(state.takenCans).toBe(0);
  });

  it('never fills past the tank', () => {
    const level = flatLevel([{ x: 20, y: 0.6, refill: 40 }]);
    const state = run(level, 60 * 6, () => INPUT.GAS);
    expect(state.fuel).toBeLessThanOrEqual(DEFAULT_TANK_SECONDS);
  });
});

describe('continuing after running dry', () => {
  it('does nothing while there is still fuel in the tank', () => {
    const state = run(flatLevel(), 120, () => INPUT.GAS | INPUT.CONTINUE);
    expect(state.continues).toBe(0);
    expect(state.x).toBeGreaterThan(1);
  });

  it('goes back to the last checkpoint and counts the continue', () => {
    const level = flatLevel();
    const simulation = createBikeSimulation(engine, level);
    // Ride until the tank is empty, which is well past the first checkpoint on this track.
    for (let tick = 0; tick < (DEFAULT_TANK_SECONDS + 2) * 60; tick++) simulation.step(INPUT.GAS);
    const dry = simulation.getState();
    expect(dry.outOfFuel).toBe(true);
    expect(dry.checkpointIndex).toBeGreaterThanOrEqual(0);

    simulation.step(INPUT.CONTINUE);
    const after = simulation.getState();
    simulation.dispose();

    expect(after.continues).toBe(1);
    expect(after.fuel).toBeGreaterThan(0);
    // Back at the checkpoint it left from, not at the start and not where it stopped.
    expect(after.x).toBeCloseTo(level.checkpoints[dry.checkpointIndex]!, 0);
  });
});
