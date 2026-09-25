/**
 * A level is DATA: a ground polyline plus gameplay markers. No angles or derived geometry are stored here —
 * `bike-sim.ts` builds physics ground segments directly from consecutive points (Box2D computes each
 * segment's own geometry internally), so level authoring never needs engine-approximated trig
 * (`Math.atan2` and friends are exactly what the determinism lint bans in this package).
 *
 * Units are Box2D metres (not pixels): keep the whole level roughly in the 0-80m range, matching the
 * physics tuning in `bike-sim.ts`. `packages/game-client` converts to pixels for rendering.
 */
export interface Level {
  readonly id: string;
  /** Ground polyline, left to right, strictly increasing x. */
  readonly ground: readonly (readonly [x: number, y: number])[];
  readonly start: { readonly x: number; readonly y: number };
  /** Checkpoint x-positions, strictly increasing, strictly between start.x and finishX. */
  readonly checkpoints: readonly number[];
  readonly finishX: number;
  /** Falling below this y (world down = negative y, Box2D convention) counts as a crash. */
  readonly killY: number;
}

/**
 * A short hand-authored test track for the Phase 5 spike: flat start, a rolling rise, a gap with a takeoff
 * ramp, a landing slope, and a flat finish. Not "Map 1" (that is Phase 6, real level design) — this exists
 * to prove the physics and controls feel right.
 */
export const TEST_LEVEL: Level = {
  id: 'spike-test-track',
  ground: [
    [-4, 0],
    [8, 0],
    [14, 1.5],
    [20, 1.5],
    [24, 3.2], // takeoff ramp
    [26, 3.6],
    // gap: no ground between x=26 and x=34 — the kill plane (killY) catches a missed jump
    [34, 1.5], // landing ramp
    [38, 0],
    [56, 0],
    [60, 0.6],
    [64, 0.6],
    [80, 0],
  ],
  start: { x: 0, y: 0.6 },
  checkpoints: [20, 38],
  finishX: 76,
  killY: -12,
};
