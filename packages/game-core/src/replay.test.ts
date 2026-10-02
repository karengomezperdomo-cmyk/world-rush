import Box2DFactory from 'box2d3-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBikeSimulation } from './bike-sim';
import { INPUT, type InputMask } from './inputs';
import { CORAL_COAST, SUNSET_CANYON } from './maps';
import { PHYSICS_ENGINE_OPTIONS, type PhysicsEngine } from './physics-engine';
import {
  decodeReplay,
  encodeReplay,
  MAX_REPLAY_TICKS,
  ReplayError,
  ReplayRecorder,
  simulateReplay,
  verifyReplay,
} from './replay';

let engine: PhysicsEngine;

beforeAll(async () => {
  engine = await Box2DFactory(PHYSICS_ENGINE_OPTIONS);
});

/** The autopilot from `maps.test.ts`: good enough to finish a map, which is what a replay needs to contain. */
function levellingPilot(angle: number): InputMask {
  if (angle > 0.12) return INPUT.GAS | INPUT.LEAN_FORWARD;
  if (angle < -0.12) return INPUT.GAS | INPUT.LEAN_BACK;
  return INPUT.GAS;
}

/** Plays a map and records it exactly as the client will: one `record()` per simulation step. */
function recordRun(level = SUNSET_CANYON): { bytes: Uint8Array; finishTick: number } {
  const simulation = createBikeSimulation(engine, level);
  const recorder = new ReplayRecorder(level.id);
  let finishTick = 0;
  for (let tick = 0; tick < 60 * 200; tick++) {
    const mask = levellingPilot(simulation.getState().angle);
    recorder.record(mask);
    simulation.step(mask);
    const state = simulation.getState();
    if (state.finished) {
      finishTick = state.finishTick ?? state.tick;
      break;
    }
  }
  simulation.dispose();
  return { bytes: recorder.encode(), finishTick };
}

describe('the replay format survives a round trip', () => {
  it('encodes and decodes the inputs it was given', () => {
    const entries = [
      { mask: INPUT.GAS as InputMask, length: 120 },
      { mask: (INPUT.GAS | INPUT.LEAN_BACK) as InputMask, length: 45 },
      { mask: 0 as InputMask, length: 3 },
    ];
    const decoded = decodeReplay(encodeReplay('sunset-canyon', entries));
    expect(decoded.levelId).toBe('sunset-canyon');
    expect(decoded.ticks).toBe(168);
    expect(decoded.entries).toEqual(entries);
  });

  it('collapses held buttons into runs instead of one entry per tick', () => {
    const recorder = new ReplayRecorder('sunset-canyon');
    for (let i = 0; i < 1000; i++) recorder.record(INPUT.GAS);
    for (let i = 0; i < 1000; i++) recorder.record(INPUT.GAS | INPUT.BRAKE);
    const decoded = decodeReplay(recorder.encode());
    expect(decoded.ticks).toBe(2000);
    // Two held buttons, so two entries — not two thousand.
    expect(decoded.entries).toHaveLength(2);
  });

  it('stays small: a real run is a few hundred bytes, not kilobytes per second', () => {
    const { bytes } = recordRun();
    expect(bytes.byteLength).toBeLessThan(4096);
  });
});

describe('the decoder rejects anything it was not given', () => {
  const valid = () => encodeReplay('sunset-canyon', [{ mask: INPUT.GAS as InputMask, length: 10 }]);

  it('refuses data that is not a replay', () => {
    expect(() => decodeReplay(new Uint8Array(32))).toThrow(ReplayError);
    expect(() => decodeReplay(new Uint8Array([1, 2, 3]))).toThrow(/too short/);
  });

  it('refuses a version it does not understand', () => {
    const bytes = valid();
    bytes[4] = 99;
    expect(() => decodeReplay(bytes)).toThrow(/version 99/);
  });

  it('refuses input bits that do not exist', () => {
    const bytes = valid();
    // The mask byte of the first entry: 6 header bytes + the level id + 4 for the tick count.
    bytes[6 + 'sunset-canyon'.length + 4] = 0b1000_0000;
    expect(() => decodeReplay(bytes)).toThrow(/unknown input bits/);
  });

  it('refuses a replay whose tick count disagrees with its entries', () => {
    const bytes = valid();
    new DataView(bytes.buffer).setUint32(6 + 'sunset-canyon'.length, 999, true);
    expect(() => decodeReplay(bytes)).toThrow(/entries total/);
  });

  it('refuses a truncated body', () => {
    expect(() => decodeReplay(valid().slice(0, -1))).toThrow(/whole number of entries/);
  });

  it('refuses a replay long enough to tie the server up', () => {
    // Guards the server, not the game: without a cap a submission could ask for billions of ticks.
    expect(() =>
      encodeReplay('sunset-canyon', [
        { mask: INPUT.GAS as InputMask, length: 0xffff },
        { mask: INPUT.GAS as InputMask, length: MAX_REPLAY_TICKS },
      ]),
    ).toThrow(/too long/);
  });
});

describe('verification is the server deciding, not the client claiming', () => {
  it('re-simulates a recorded run to exactly the same finish time', () => {
    const { bytes, finishTick } = recordRun();
    expect(finishTick).toBeGreaterThan(0);
    const outcome = verifyReplay(engine, SUNSET_CANYON, bytes);
    expect(outcome.finished).toBe(true);
    // Exact: this equality IS the anti-cheat. A tolerance here would accept a doctored replay.
    expect(outcome.finishTick).toBe(finishTick);
  });

  it('gives the same verdict every time it is checked', () => {
    const { bytes } = recordRun();
    const first = verifyReplay(engine, SUNSET_CANYON, bytes);
    const second = verifyReplay(engine, SUNSET_CANYON, bytes);
    expect(second).toEqual(first);
  });

  it('refuses to verify a replay against a different map', () => {
    const { bytes } = recordRun();
    expect(() => verifyReplay(engine, CORAL_COAST, bytes)).toThrow(/not "coral-coast"/);
  });

  it('reports a tampered replay as not finishing, rather than as a faster time', () => {
    const { bytes, finishTick } = recordRun();
    const decoded = decodeReplay(bytes);
    // Cut the run short: the classic forgery is claiming the same race took fewer ticks.
    const truncated = decoded.entries.slice(0, Math.floor(decoded.entries.length / 2));
    const outcome = simulateReplay(engine, SUNSET_CANYON, {
      levelId: decoded.levelId,
      ticks: truncated.reduce((total, entry) => total + entry.length, 0),
      entries: truncated,
    });
    expect(outcome.finished).toBe(false);
    expect(outcome.finishTick).toBeNull();
    expect(outcome.ticksSimulated).toBeLessThan(finishTick);
  });

  it('does not accept a replay of nothing', () => {
    const outcome = simulateReplay(engine, SUNSET_CANYON, {
      levelId: 'sunset-canyon',
      ticks: 0,
      entries: [],
    });
    expect(outcome.finished).toBe(false);
    expect(outcome.durationMs).toBeNull();
  });

  it('reports the duration in whole milliseconds, which is what the database stores', () => {
    const { bytes } = recordRun();
    const outcome = verifyReplay(engine, SUNSET_CANYON, bytes);
    expect(outcome.durationMs).toBeTypeOf('number');
    expect(Number.isInteger(outcome.durationMs)).toBe(true);
    expect(outcome.durationMs).toBeGreaterThan(1000);
  });
});
