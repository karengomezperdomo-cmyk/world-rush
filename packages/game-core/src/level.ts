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
  /**
   * Falling below this y (world down = negative y, Box2D convention) counts as a crash. Raising it toward
   * the track is a difficulty lever in itself: on Coral Coast the water sits just under the shoreline, so a
   * gap punishes immediately instead of giving the rider a long fall to think about it.
   */
  readonly killY: number;
  /**
   * Ground friction, default 1.0. Lower is slippery: the rear wheel spins instead of driving, so the bike
   * accelerates and brakes worse. This is what makes Frost Peak's "slippery slopes" a real mechanic rather
   * than a colour change.
   */
  readonly groundFriction?: number;
}

/** A run of ground, as relative `[dx, dy]` steps from wherever the previous piece left off. */
export interface GroundPiece {
  readonly steps: readonly (readonly [dx: number, dy: number])[];
}

/** A hole of `width` metres; the ground resumes `drop` metres lower (negative resumes higher). */
export interface GapPiece {
  readonly gap: number;
  readonly drop?: number;
}

export type TrackPiece = GroundPiece | GapPiece;

/**
 * Builds a whole track's strips from a start point and an alternating list of ground and gaps.
 *
 * Gaps are declared by WIDTH and the builder works out where the next strip begins. Authoring those
 * positions by hand is how the first draft of Sunset Canyon ended up with a 15 m gap where 6.5 m was
 * intended, and later with two strips overlapping into a negative-width gap — twice, because a strip's end
 * is the sum of a dozen steps and nobody re-adds that in their head after a tweak.
 */
export function buildTrack(
  startX: number,
  startY: number,
  pieces: readonly TrackPiece[],
): GroundStrip[] {
  const strips: GroundStrip[] = [];
  let x = startX;
  let y = startY;
  for (const piece of pieces) {
    if ('gap' in piece) {
      x += piece.gap;
      y -= piece.drop ?? 0;
      continue;
    }
    const built = strip(x, y, piece.steps);
    strips.push(built);
    const last = built[built.length - 1];
    if (last) {
      x = last[0];
      y = last[1];
    }
  }
  return strips;
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
 * The ground's y at a given x, or `undefined` when x falls in a gap (or outside the track entirely).
 *
 * Respawning needs this. Deriving the respawn height from wherever the bike last touched down instead is
 * what locked maps 4-7 into an endless crash loop (found 2026-09-29): the checkpoint's x was correct but the
 * y came from a different part of the track, so on any map with real elevation change the bike rematerialised
 * *inside* the terrain, Box2D ejected it, that counted as a crash, and it respawned into the same rock again.
 *
 * Linear interpolation only — no trig, so the determinism lint in this package stays satisfied.
 */
export function groundYAt(level: Level, x: number): number | undefined {
  for (const groundStrip of level.ground) {
    for (let i = 0; i < groundStrip.length - 1; i++) {
      const a = groundStrip[i];
      const b = groundStrip[i + 1];
      if (!a || !b) continue;
      if (x >= a[0] && x <= b[0]) {
        const span = b[0] - a[0];
        if (span <= 0) continue;
        return a[1] + ((b[1] - a[1]) * (x - a[0])) / span;
      }
    }
  }
  return undefined;
}

/**
 * Picks checkpoint positions that are actually survivable, from the track's own geometry.
 *
 * Checkpoints were hand-authored until 2026-09-29, and they were wrong on six of the seven maps: typed at
 * round numbers like 100 or 320, they landed on takeoff lips, inside gaps, or a few metres in front of a jump.
 * A checkpoint is where the rider restarts FROM REST, so each one needs enough unbroken ground ahead to
 * rebuild speed before the next hole — otherwise a single crash ends the run permanently, which is the worst
 * bug this game can have and the hardest to notice, because a clean lap never touches it.
 *
 * The rule: stand at the entrance to a strip (or a point along it), and only accept it if the ground runs at
 * least `minRunway` metres before that strip ends at a gap. The final strip carries the finish line, so any
 * point on it is safe.
 */
export function autoCheckpoints(
  ground: readonly GroundStrip[],
  finishX: number,
  options: { readonly minRunway?: number; readonly spacing?: number } = {},
): number[] {
  const minRunway = options.minRunway ?? 50;
  const spacing = options.spacing ?? 90;
  const candidates: number[] = [];

  for (let stripIndex = 1; stripIndex < ground.length; stripIndex++) {
    const stripPoints = ground[stripIndex];
    if (!stripPoints || stripPoints.length < 2) continue;
    const first = stripPoints[0];
    const last = stripPoints[stripPoints.length - 1];
    if (!first || !last) continue;
    const isFinalStrip = stripIndex === ground.length - 1;
    // Two metres in, so the checkpoint is never exactly on the strip's edge.
    for (let x = first[0] + 2; x < last[0]; x += spacing) {
      if (isFinalStrip || last[0] - x >= minRunway) candidates.push(x);
    }
  }

  const chosen: number[] = [];
  for (const candidate of candidates) {
    if (candidate > finishX - 40) continue;
    const previous = chosen[chosen.length - 1];
    if (previous !== undefined && candidate - previous < spacing) continue;
    chosen.push(candidate);
  }
  return chosen;
}

/**
 * Builds a level, deriving the checkpoints from the geometry unless they are given explicitly.
 *
 * On a low-friction map the bike needs noticeably more road to get back up to speed, so respawn points there
 * demand a longer run-up than they do on rock.
 */
export function defineLevel(
  spec: Omit<Level, 'checkpoints'> & { checkpoints?: readonly number[] },
): Level {
  const slippery = (spec.groundFriction ?? 1.0) < 1.0;
  return {
    ...spec,
    checkpoints:
      spec.checkpoints ??
      autoCheckpoints(spec.ground, spec.finishX, { minRunway: slippery ? 60 : 50 }),
  };
}
