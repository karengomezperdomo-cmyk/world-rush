import Box2DFactory from 'box2d3-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBikeSimulation, TICK_SECONDS, type BikeState } from './bike-sim';
import { INPUT, type InputMask } from './inputs';
import { groundYAt, type Level } from './level';
import { MAPS } from './maps';
import { PHYSICS_ENGINE_OPTIONS, type PhysicsEngine } from './physics-engine';

let engine: PhysicsEngine;

beforeAll(async () => {
  engine = await Box2DFactory(PHYSICS_ENGINE_OPTIONS);
});

/** Generous: a map is allowed to take far longer than its target before we call it unfinishable. */
const TIMEOUT_TICKS = 60 * 300;

interface RideResult {
  finished: boolean;
  /** Simulation seconds actually spent, which includes time lost to crashes and respawns. */
  seconds: number;
  crashes: number;
  furthestX: number;
}

function ride(level: Level, pilot: (state: BikeState) => InputMask): RideResult {
  const sim = createBikeSimulation(engine, level);
  let crashes = 0;
  let wasCrashed = false;
  let furthestX = 0;

  for (let tick = 0; tick < TIMEOUT_TICKS; tick++) {
    sim.step(pilot(sim.getState()));
    const state = sim.getState();
    if (state.crashed && !wasCrashed) crashes++;
    wasCrashed = state.crashed;
    furthestX = Math.max(furthestX, state.x);
    if (state.finished) {
      sim.dispose();
      return { finished: true, seconds: state.tick * TICK_SECONDS, crashes, furthestX };
    }
  }

  const state = sim.getState();
  sim.dispose();
  return { finished: false, seconds: state.tick * TICK_SECONDS, crashes, furthestX };
}

/** Holds the throttle and nothing else — the least skilled rider there is. */
const throttleOnly = (): InputMask => INPUT.GAS;

/**
 * A deliberately crude autopilot: full throttle, plus LEAN to fight the chassis back towards level.
 *
 * It is not meant to ride well, only to prove a map is *possible* — if this much clumsiness gets to the
 * finish, a person can. The harder maps are built to need exactly this input (steep ramps leave the bike
 * rotating, and nothing else can straighten it mid-air), so "throttle alone is not enough, but throttle
 * plus attitude correction is" is the mechanical definition of difficulty here.
 */
function levellingPilot(state: BikeState): InputMask {
  const LEAN_DEADZONE = 0.12; // radians; below this the bike is level enough to leave alone
  if (state.angle > LEAN_DEADZONE) return INPUT.GAS | INPUT.LEAN_FORWARD; // nose up -> push it down
  if (state.angle < -LEAN_DEADZONE) return INPUT.GAS | INPUT.LEAN_BACK; // nose down -> pull it up
  return INPUT.GAS;
}

/**
 * Structural checks that need no physics at all. Every one of these caught a real bug in the first draft of
 * maps 2-7 (2026-09-29), and each was invisible to the "can it be finished" tests: a map with no `finishX`
 * simply rides off the end of the world forever, and a checkpoint in the wrong place only bites the rider
 * who happens to crash.
 */
describe('map data is structurally sound', () => {
  it.each(MAPS.map((map) => [map.number, map.name, map] as const))(
    'map %i (%s) has a finish the rider can actually reach',
    (_number, _name, map) => {
      const { level } = map;
      // Maps 2-7 shipped with NO finishX at all. TypeScript should have caught it, but vitest does not
      // typecheck, so the suite ran green on the parts it could see while nothing could ever finish.
      expect(typeof level.finishX, 'finishX must be declared').toBe('number');
      expect(Number.isFinite(level.finishX)).toBe(true);
      expect(level.finishX).toBeGreaterThan(level.start.x);
      // The finish line must be on solid ground, not floating over a hole.
      expect(groundYAt(level, level.finishX), 'the finish line must sit on ground').not.toBeUndefined();
    },
  );

  it.each(MAPS.map((map) => [map.number, map.name, map] as const))(
    'map %i (%s) has checkpoints on solid ground, in order, inside the track',
    (_number, _name, map) => {
      const { level } = map;
      let previous = level.start.x;
      for (const checkpoint of level.checkpoints) {
        expect(checkpoint, `checkpoints must increase (after ${previous})`).toBeGreaterThan(previous);
        expect(checkpoint, 'checkpoints must be before the finish').toBeLessThan(level.finishX);
        // Orbit Circuit had one at x=100, in mid-air over the opening 14 m hole. Respawning there dropped
        // the rider through the floor, crashed, respawned in the same spot, forever.
        expect(
          groundYAt(level, checkpoint),
          `checkpoint at x=${checkpoint} is in a gap, not on ground`,
        ).not.toBeUndefined();
        previous = checkpoint;
      }
    },
  );

  it.each(MAPS.map((map) => [map.number, map.name, map] as const))(
    'map %i (%s) has well-formed ground strips',
    (_number, _name, map) => {
      const strips = map.level.ground;
      expect(strips.length).toBeGreaterThan(0);
      for (const strip of strips) {
        expect(strip.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < strip.length; i++) {
          expect(strip[i]![0], 'points within a strip must advance').toBeGreaterThan(strip[i - 1]![0]);
        }
      }
      // Consecutive strips must leave a real, positive-width hole. Authoring these by hand produced
      // overlapping strips (a negative gap) twice before `buildTrack` existed.
      for (let i = 1; i < strips.length; i++) {
        const previousEnd = strips[i - 1]![strips[i - 1]!.length - 1]![0];
        const nextStart = strips[i]![0]![0];
        expect(nextStart, `strips ${i - 1} and ${i} overlap`).toBeGreaterThan(previousEnd);
      }
    },
  );

  it('the week is seven distinct maps, one per day, rising in difficulty', () => {
    expect(MAPS).toHaveLength(7);
    expect(MAPS.map((map) => map.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(MAPS.map((map) => map.day)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
    expect(new Set(MAPS.map((map) => map.level.id)).size).toBe(7);
    for (const map of MAPS) {
      expect(map.difficulty).toBeGreaterThanOrEqual(1);
      expect(map.difficulty).toBeLessThanOrEqual(5);
    }
    // Monotonic, so the week actually ramps rather than jumping around.
    const difficulties = MAPS.map((map) => map.difficulty);
    for (let i = 1; i < difficulties.length; i++) {
      expect(difficulties[i]!).toBeGreaterThanOrEqual(difficulties[i - 1]!);
    }
  });
});

describe('every map is completable', () => {
  for (const map of MAPS) {
    it(`map ${map.number} (${map.name}, difficulty ${map.difficulty}) can be finished`, () => {
      const result = ride(map.level, levellingPilot);
      expect(
        result.finished,
        `got stuck at x=${result.furthestX.toFixed(0)} of ${map.level.finishX} after ` +
          `${result.seconds.toFixed(0)}s and ${result.crashes} crashes`,
      ).toBe(true);
    });
  }
});

/**
 * The test that matters most after a crash, and the one whose absence let two maps ship broken.
 *
 * A checkpoint is not just a marker: it is where the rider restarts from rest. If there is not enough road
 * between it and the next gap to rebuild speed, that respawn is a death sentence and the run is over — Steel
 * Yard's first draft put one 16 m in front of a 12 m jump, which needs roughly 45 m.
 *
 * Restarting the level AT the checkpoint is a faithful stand-in for respawning there: same position, same
 * standing start, same road ahead.
 */
describe('every checkpoint can be restarted from', () => {
  for (const map of MAPS) {
    for (const [index, checkpoint] of map.level.checkpoints.entries()) {
      it(`map ${map.number} (${map.name}) is still winnable from checkpoint ${index + 1} at x=${checkpoint}`, () => {
        const groundY = groundYAt(map.level, checkpoint);
        expect(groundY, 'checkpoint must be on ground').not.toBeUndefined();
        const fromCheckpoint: Level = {
          ...map.level,
          start: { x: checkpoint, y: groundY! + 1.0 },
          checkpoints: map.level.checkpoints.slice(index),
        };
        const result = ride(fromCheckpoint, levellingPilot);
        expect(
          result.finished,
          `restarting at x=${checkpoint} only reached x=${result.furthestX.toFixed(0)} of ` +
            `${map.level.finishX} — not enough road to rebuild speed before the next gap`,
        ).toBe(true);
      });
    }
  }
});

describe('difficulty is mechanical, not decorative', () => {
  /**
   * Decision B4: 45-90 s per map. Measured on the autopilot, which holds full throttle throughout, so this is
   * close to a floor rather than a typical human run. The lower bound is deliberately a little under 45 to
   * leave tuning room without letting a map quietly shrink into a sprint.
   */
  it.each(MAPS.map((map) => [map.number, map.name, map] as const))(
    'map %i (%s) finishes inside a sane time budget',
    (_number, _name, map) => {
      const result = ride(map.level, levellingPilot);
      expect(result.finished).toBe(true);
      expect(result.seconds, 'too short to be a race').toBeGreaterThan(40);
      expect(result.seconds, 'too long for a daily time trial').toBeLessThan(90);
    },
  );

  it('the easiest maps forgive a rider who only holds the throttle', () => {
    for (const map of MAPS.filter((entry) => entry.difficulty === 1)) {
      const result = ride(map.level, throttleOnly);
      expect(result.finished, `${map.name} should be finishable on throttle alone`).toBe(true);
      expect(result.crashes, `${map.name} should not crash a throttle-only rider`).toBe(0);
    }
  });

  it('the hardest map demands more than holding the throttle', () => {
    const hardest = MAPS.reduce((a, b) => (b.difficulty > a.difficulty ? b : a));
    const lazy = ride(hardest.level, throttleOnly);
    const skilled = ride(hardest.level, levellingPilot);
    expect(skilled.finished, `${hardest.name} must still be possible`).toBe(true);
    // Either the lazy rider never gets there, or it costs them crashes the skilled rider avoids.
    expect(!lazy.finished || lazy.crashes > skilled.crashes).toBe(true);
  });
});

describe('respawning puts the bike on the ground', () => {
  /**
   * The bug this exists for: the respawn took its x from the checkpoint but its y from wherever the bike had
   * last touched down, somewhere else entirely. On every map with real elevation change the bike rematerialised
   * inside the terrain, Box2D ejected it, that counted as a crash, and it respawned into the same rock again —
   * 200+ times in a row. Maps 4-7 were all unfinishable and map 1, being nearly flat, never showed it.
   */
  it('knows the ground height along a track and reports gaps as gaps', () => {
    const level = MAPS[3]!.level; // Steel Yard: flat tops at several different heights
    const [firstStrip] = level.ground;
    const start = firstStrip![0]!;
    expect(groundYAt(level, start[0])).toBeCloseTo(start[1], 6);

    const firstEnd = firstStrip![firstStrip!.length - 1]!;
    const secondStart = level.ground[1]![0]!;
    // Midway across the hole between strip 1 and strip 2 there is no ground.
    expect(groundYAt(level, (firstEnd[0] + secondStart[0]) / 2)).toBeUndefined();
    // Past the very end of the track there is no ground either.
    const lastStrip = level.ground[level.ground.length - 1]!;
    expect(groundYAt(level, lastStrip[lastStrip.length - 1]![0] + 50)).toBeUndefined();
  });

  it('interpolates along a sloped segment rather than snapping to a corner', () => {
    const level = MAPS[0]!.level; // Sunset Canyon opens with 30 m of flat, then a 12 m climb of 1.2 m
    const [strip] = level.ground;
    const a = strip![1]!; // end of the flat
    const b = strip![2]!; // top of the first climb
    const midX = (a[0] + b[0]) / 2;
    expect(groundYAt(level, midX)).toBeCloseTo((a[1] + b[1]) / 2, 6);
  });

  it('a rider who crashes gets going again instead of looping', () => {
    // Steel Yard is the map that crashes the autopilot, so it is the one that proves respawns recover.
    const steelYard = MAPS[3]!;
    const result = ride(steelYard.level, levellingPilot);
    expect(result.finished).toBe(true);
    // A handful of crashes is the map doing its job; hundreds means every respawn crashed again immediately.
    expect(result.crashes, 'respawn loop').toBeLessThan(10);
  });
});
