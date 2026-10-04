import Box2DFactory from 'box2d3-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBikeSimulation, type BikeState } from './bike-sim';
import { INPUT } from './inputs';
import { defineLevel, type Level } from './level';
import { PHYSICS_ENGINE_OPTIONS, type PhysicsEngine } from './physics-engine';

/**
 * Obstacles, ramps and hazards — and the sizes that decide what each one IS.
 *
 * Before these, a level was ground, gaps, friction and a kill height: four knobs, which is why all seven
 * maps were the same map at different amplitudes.
 *
 * The numbers below were measured against the physics, not chosen. They are here because they are what a map
 * author needs to know, and because every one of them contradicted a reasonable guess made first.
 */

let engine: PhysicsEngine;

beforeAll(async () => {
  engine = await Box2DFactory(PHYSICS_ENGINE_OPTIONS);
});

function track(extra: Partial<Level> = {}): Level {
  return defineLevel({
    id: 'obstacle-test',
    ground: [
      [
        [-10, 0],
        [400, 0],
      ],
    ],
    start: { x: 0, y: 0.6 },
    checkpoints: [150],
    finishX: 380,
    killY: -10,
    ...extra,
  });
}

/** Rides at full throttle, reporting the furthest point reached and how many crashes it took to get there. */
function ride(level: Level, seconds = 8): { state: BikeState; maxX: number; crashes: number } {
  const simulation = createBikeSimulation(engine, level);
  let crashes = 0;
  let wasCrashed = false;
  let maxX = 0;
  let maxY = 0;
  for (let tick = 0; tick < 60 * seconds; tick++) {
    simulation.step(INPUT.GAS);
    const state = simulation.getState();
    if (state.crashed && !wasCrashed) crashes += 1;
    wasCrashed = state.crashed;
    maxX = Math.max(maxX, state.x);
    maxY = Math.max(maxY, state.y);
  }
  const state = simulation.getState();
  simulation.dispose();
  return { state: { ...state, y: maxY }, maxX, crashes };
}

describe('blocks', () => {
  it('a wall across the track stops the bike', () => {
    const open = ride(track(), 6);
    const walled = ride(
      track({ blocks: [{ x: 30, y: 1.5, width: 1, height: 3, art: 'concrete' }] }),
      6,
    );

    expect(open.maxX).toBeGreaterThan(35);
    expect(walled.maxX).toBeLessThan(30);
  });

  it('is only in the way where it is', () => {
    // The same wall, lifted overhead: the bike rides underneath it untouched.
    const overhead = ride(track({ blocks: [{ x: 30, y: 8, width: 1, height: 3 }] }), 6);
    expect(overhead.maxX).toBeCloseTo(ride(track(), 6).maxX, 0);
  });
});

/**
 * Round obstacles come in exactly two useful sizes, and the gap between them is a trap.
 *
 * The wheel's radius is 0.4 m. Measured at full throttle (~18 m/s):
 *
 * | total height | what happens                               |
 * | ------------ | ------------------------------------------ |
 * | 0.10 m       | ridden straight over, no crash             |
 * | 0.16–0.40 m  | **always a crash**, whatever the rider does |
 * | 0.60 m       | a wall: the bike stops dead against it     |
 *
 * The middle band was tried at full throttle, lifting off, and leaning back: all three crashed, every time.
 * So a mid-sized round is not a skill test, it is an unavoidable crash dressed up as a bump — which is why
 * no map should place one. Decoration below 0.1 m, obstacle above 0.5 m, nothing in between.
 */
describe('rounds', () => {
  it('a low pipe is texture: ridden straight over', () => {
    const result = ride(track({ rounds: [{ x: 25, y: 0.05, radius: 0.05, art: 'pipe' }] }), 8);
    expect(result.maxX).toBeGreaterThan(60);
    expect(result.crashes).toBe(0);
  });

  it('a pipe taller than the wheel axle is a wall', () => {
    const result = ride(track({ rounds: [{ x: 25, y: 0.3, radius: 0.3 }] }), 8);
    expect(result.maxX).toBeLessThan(25);
  });

  it('the middle band is a crash trap, which is why maps must not use it', () => {
    const result = ride(track({ rounds: [{ x: 25, y: 0.12, radius: 0.12 }] }), 8);
    expect(result.crashes).toBeGreaterThan(0);
  });
});

/**
 * Ramps are the only thing here that creates air rather than taking it away, and the number that matters is
 * the SLOPE, not the height. Measured at full throttle:
 *
 * | ramp      | slope   | air    | outcome            |
 * | --------- | ------- | ------ | ------------------ |
 * | 2 x 0.5 m | 1 : 4   | 1.74 m | lands and rides on |
 * | 3 x 0.8 m | 1 : 3.8 | 2.04 m | lands and rides on |
 * | 5 x 2.0 m | 1 : 2.5 | 3.64 m | lands and rides on |
 * | 2 x 1.2 m | 1 : 1.7 | 3.39 m | **backflips**      |
 *
 * So height is free and steepness is not: a 2 m ramp is fine over 5 m and lethal over 2 m.
 */
describe('ramps', () => {
  it('launches the bike and lets it land', () => {
    const flat = ride(track(), 12);
    const jumped = ride(
      track({ ramps: [{ x: 25, y: 0, width: 3, height: 0.8, art: 'dirt' }] }),
      12,
    );

    expect(jumped.state.y).toBeGreaterThan(flat.state.y + 1);
    expect(jumped.crashes).toBe(0);
    expect(jumped.maxX).toBeGreaterThan(100);
  });

  it('backflips the bike when it is too steep for its length', () => {
    const steep = ride(track({ ramps: [{ x: 25, y: 0, width: 2, height: 1.2 }] }), 12);
    expect(steep.crashes).toBeGreaterThan(0);
  });
});

describe('hazards', () => {
  it('ends the run on contact, at track level, with no fall needed', () => {
    const level = track({ hazards: [{ x: 30, y: 0.5, width: 6, height: 2, art: 'lava' }] });
    const result = ride(level, 8);
    expect(result.crashes).toBeGreaterThan(0);
    // Killed inside the pool, not at the bottom of the world.
    expect(result.state.y).toBeGreaterThan(level.killY);
  });

  it('does nothing when the bike never reaches it', () => {
    expect(ride(track({ hazards: [{ x: 300, y: 0.5, width: 6, height: 2 }] }), 4).crashes).toBe(0);
  });
});
