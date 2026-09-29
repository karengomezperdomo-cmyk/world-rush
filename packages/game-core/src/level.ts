/**
 * A level is DATA: ground geometry plus gameplay markers. No angles or derived geometry are stored here —
 * `bike-sim.ts` builds physics ground segments directly from consecutive points (Box2D computes each
 * segment's own geometry internally), so level authoring never needs engine-approximated trig
 * (`Math.atan2` and friends are exactly what the determinism lint bans in this package).
 *
 * Units are Box2D metres (not pixels), matching the physics tuning in `bike-sim.ts`.
 * `packages/game-client` converts to pixels for rendering.
 */

/** One unbroken run of ground, left to right, strictly increasing x. */
export type GroundStrip = readonly (readonly [x: number, y: number])[];

export interface Level {
  readonly id: string;
  /**
   * Ground as SEPARATE strips, not one polyline: the empty space between the end of one strip and the
   * start of the next is a real hole the bike can fall through. A single polyline could only ever describe
   * a continuous surface — the Phase 5 test track's "gap" was really just a steep downhill, because every
   * consecutive pair of points got a segment (found 2026-09-26 while authoring the first real map).
   */
  readonly ground: readonly GroundStrip[];
  readonly start: { readonly x: number; readonly y: number };
  /** Checkpoint x-positions, strictly increasing, strictly between start.x and finishX. */
  readonly checkpoints: readonly number[];
  readonly finishX: number;
  /** Falling below this y (world down = negative y, Box2D convention) counts as a crash. */
  readonly killY: number;
}

/**
 * Builds one strip from a starting point plus relative `[dx, dy]` steps. Authoring 400 m of terrain as
 * absolute coordinates is unreadable and impossible to re-tune; steps describe what the rider actually
 * meets ("18 m of flat, then 6 m rising 2 m"). Deliberately linear-only — every section is a straight
 * segment, so nothing here needs trig, and the result is plain data either way.
 */
function strip(
  startX: number,
  startY: number,
  steps: readonly (readonly [dx: number, dy: number])[],
): GroundStrip {
  const points: [number, number][] = [[startX, startY]];
  let x = startX;
  let y = startY;
  for (const step of steps) {
    x += step[0];
    y += step[1];
    points.push([x, y]);
  }
  return points;
}

/**
 * A short hand-authored test track for the Phase 5 spike: flat start, a rolling rise, a real gap with a
 * takeoff ramp, a landing slope, and a flat finish. Not "Map 1" (that is `SUNSET_CANYON`) — this exists to
 * prove the physics and controls behave, and the tests in `bike-sim.test.ts` are tuned against it.
 */
export const TEST_LEVEL: Level = {
  id: 'spike-test-track',
  ground: [
    // Start, rolling rise, then the takeoff ramp — this strip ENDS at the lip of the jump.
    strip(-4, 0, [
      [12, 0],
      [6, 1.5],
      [6, 0],
      [4, 1.7], // takeoff ramp
      [2, 0.4],
    ]),
    // Landing side: a genuine hole sits between x=26 and x=34, so a missed jump falls to killY.
    strip(34, 1.5, [
      [4, -1.5],
      [18, 0],
      [4, 0.6],
      [4, 0],
      [16, -0.6],
    ]),
  ],
  start: { x: 0, y: 0.6 },
  checkpoints: [20, 38],
  finishX: 76,
  killY: -12,
};

/**
 * **Map 1 — Sunset Canyon** (design/art/manifest.json: MON, difficulty 1 of 5, "Speed through the rocks.
 * Master the jumps. Beat the clock.").
 *
 * The easiest map of the week, so the shape is forgiving: a long runway to learn the throttle, rollers that
 * teach the suspension, then two real gaps with generous landing ramps. Checkpoints sit just before each
 * hazard, so a bad jump costs seconds, not the run.
 *
 * Length is tuned to decision B4 (45-90 s per map): ~390 m, which a rider holding throttle covers in
 * roughly 50 s, and a cautious one in rather more.
 */
export const SUNSET_CANYON: Level = {
  id: 'sunset-canyon',
  ground: [
    // --- Opening: long runway, then rollers that never threaten, up to a deliberately SHALLOW takeoff.
    // Ramp angle matters more than ramp height here: measured on the real bike, a 2.2 m rise over 8 m
    // spins it into an uncontrolled backflip at full speed, which is no way to greet a rider on the
    // easiest map of the week. Spreading the same climb over 16 m launches it flat instead.
    strip(-6, 0, [
      [30, 0], // runway: room to reach full speed before anything happens
      [12, 1.2], // first rise
      [10, 0],
      [12, -1.2], // and back down
      [18, 0],
      [12, 1.6], // rollers, long enough to stay gentle
      [10, -0.9],
      [12, 1.4],
      [10, -1.6],
      [16, 0],
      [16, 2.0], // shallow takeoff ramp for the first gap (lip at x=142, y=2.5)
    ]),
    // --- First gap: 9 m, landing 1.4 m lower. Measured, not guessed: at full throttle the bike crosses
    // the lip near 15 m/s and covers well over 10 m before it comes down, so this is a jump a rider
    // clears by simply holding the throttle — which is what difficulty 1 should feel like.
    strip(161, 1.1, [
      [14, -0.6], // landing slope
      [20, 0],
      [14, 1.6],
      [12, -0.8],
      [16, 0],
      [14, -1.8], // drop to the canyon floor
      [26, 0],
      [16, 1.1],
      [12, 0],
      [14, -1.1],
      [24, 0],
      [18, 2.4], // second takeoff: higher, still shallow enough to leave the bike level (lip x=351, y=2.9)
    ]),
    // --- Second gap: 12 m, the "master the jumps" moment. Wider and faster, landing 1.5 m lower, so it
    // still rewards commitment rather than punishing it.
    strip(373, 0.6, [
      [16, -0.8], // landing slope
      [22, -1.0],
      [20, 0],
      [16, 1.2],
      [16, -1.2],
      [24, 0],
      [18, 1.4], // long canyon-floor rollers, all stretched out enough to keep the bike planted
      [18, -1.4],
      [26, 0],
      [20, 1.6],
      [20, -1.6],
      [24, 0],
      [18, 1.2],
      [18, -1.2],
      // Deliberately flat and long into the finish: an earlier version had a crest 24 m out that threw the
      // bike into a bad landing right on the line, which the deterministic ride-through caught.
      [105, 0],
    ]),
  ],
  start: { x: 0, y: 0.6 },
  // Each one sits on solid ground a good run-up BEFORE its hazard, never on a takeoff lip: respawning at
  // the edge of a jump would drop the rider straight back into the hole they just fell in.
  checkpoints: [110, 230, 330, 450, 560],
  finishX: 720,
  killY: -14,
};
