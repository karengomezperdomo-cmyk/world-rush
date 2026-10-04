import { buildTrack, defineLevel, type Level } from './level';

/**
 * The week's seven maps, matching `design/art/manifest.json` (name, day, difficulty, accent, tagline).
 * One map opens per day (decision A3 fixes the cut-over hour; the rotation itself is Phase 8).
 *
 * ## The jump budget is MEASURED, not guessed
 *
 * Every gap here is sized against a parametric sweep of this exact bike against this exact physics build
 * (run 2026-09-29: isolated runway + ramp + gap, ridden by the same autopilot `maps.test.ts` uses):
 *
 * | approach to the lip  | takeoff speed | widest gap actually cleared                           |
 * | -------------------- | ------------- | ----------------------------------------------------- |
 * | 34 m from standstill | ~15.0 m/s     | 12-13 m, and only off a steep ramp                    |
 * | 70 m from standstill | ~17.5 m/s     | 16 m (17 m only off a very steep, speed-killing ramp) |
 *
 * So **14 m is the practical ceiling** and nothing here exceeds it: the sweep measured one clean jump in
 * isolation, while a real rider arrives unsettled. The first draft of maps 5 and 7 asked for 15-17 m gaps
 * after 18-22 m run-ups and was simply impossible — the autopilot could not finish them at all, which is
 * exactly what `maps.test.ts` exists to catch.
 *
 * Two corollaries that shape every layout below:
 * - **The approach, not the ramp, sets the maximum gap.** A gap right after a short landing strip is limited
 *   by whatever speed survived the landing, not by how steep its kicker is.
 * - **Ramp angle controls attitude, not distance.** Height matters far less than steepness: 2.4 m over 12 m
 *   launches the bike rotating and the rider must straighten it with LEAN; the same rise over 16 m does not.
 *
 * ## Difficulty levers, in order of how much they actually hurt
 *
 * 1. **Gap width relative to its approach** — the real one.
 * 2. **Landing length.** A short strip has to be hit accurately: overshoot and the next hole is already there.
 * 3. **Ramp steepness**, which forces mid-air LEAN correction.
 * 4. **`killY`.** Close under the track (Coral Coast's water) means a mistake ends instantly.
 * 5. **Checkpoint spacing**, which sets what one crash costs.
 * 6. **`groundFriction`.** Honest measurement: at 0.45 the bike still reaches the SAME top speed on a long
 *    runway, it just takes much longer to get there, so it barely moves the jump budget. Its real bite is
 *    slow recovery after a crash and weak braking — a narrower mechanic than the "huge air" tagline implies.
 *
 * Every map here is proven completable by an automated rider in `maps.test.ts`.
 */

/** Map 1 — MON, difficulty 1. Forgiving by design: holding the throttle is enough to finish. */
export const SUNSET_CANYON: Level = defineLevel({
  id: 'sunset-canyon',
  ground: buildTrack(-6, 0, [
    {
      steps: [
        [30, 0], // runway: room to reach full speed before anything happens
        [12, 1.2],
        [10, 0],
        [12, -1.2],
        [18, 0],
        [12, 1.6], // rollers, long enough to stay gentle
        [10, -0.9],
        [12, 1.4],
        [10, -1.6],
        [16, 0],
        [16, 2.0], // shallow takeoff: a steeper one backflips the bike at this speed
      ],
    },
    { gap: 9, drop: 1.4 },
    {
      steps: [
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
        [18, 2.4],
      ],
    },
    { gap: 12, drop: 1.3 },
    {
      steps: [
        [16, -0.8],
        [22, -1.0],
        [20, 0],
        [16, 1.2],
        [16, -1.2],
        [24, 0],
        [18, 1.4],
        [18, -1.4],
        [26, 0],
        [20, 1.6],
        [20, -1.6],
        [24, 0],
        [18, 1.2],
        [18, -1.2],
        [105, 0], // deliberately flat into the finish: an earlier crest here ruined the landing on the line
      ],
    },
  ]),
  start: { x: 0, y: 0.6 },
  finishX: 720,
  killY: -14,
  // Monday is the gentle one, and `maps.test.ts` holds it to that: a rider who only holds the throttle
  // must finish without crashing. The first draft of this put a stack of crates at 150 m and the test
  // came back with fifteen crashes — on the ground, in a side-scroller, there is no "beside the line",
  // so any block is a wall. Blocks therefore start on the harder maps. Monday gets kickers gentle enough
  // to ride blind, and fuel cans, which cost nothing to ignore and reward a rider who goes for them.
  ramps: [
    { x: 232, width: 4, height: 1.1, art: 'wood' },
    { x: 470, width: 5, height: 1.1, art: 'dirt' },
  ],
  fuelCans: [
    { x: 120, refill: 6 },
    { x: 250, y: 2.6, refill: 8 }, // deliberately high: this one is only reachable off the kicker at 232
    { x: 400, refill: 6 },
    { x: 560, refill: 8 },
  ],
});

/**
 * Map 2 — TUE, difficulty 2. "Ride the shoreline. Do not touch the water."
 * The water sits just below the sand, so `killY` is shallow: the gaps are modest, but falling short ends the
 * run instantly instead of after a long, survivable drop. That is the whole map — geometry an easy rider can
 * handle, with the consequence of a mistake raised right up under the wheels.
 */
export const CORAL_COAST: Level = defineLevel({
  id: 'coral-coast',
  ground: buildTrack(-6, 0, [
    {
      steps: [
        [26, 0],
        [14, 0.8], // low dunes
        [12, -0.8],
        [16, 1.0],
        [14, -1.0],
        [20, 0],
        [14, 1.6],
      ],
    },
    { gap: 8, drop: 1.0 },
    {
      steps: [
        [12, -0.6],
        [18, 0],
        [12, 1.2],
        [10, -1.2],
        [22, 0],
        [14, 1.8],
      ],
    },
    { gap: 10, drop: 1.2 },
    {
      steps: [
        [14, -0.8],
        [20, 0],
        [16, 1.0],
        [14, -1.0],
        [18, 0],
        [16, 2.0],
      ],
    },
    { gap: 11, drop: 1.4 },
    {
      steps: [
        [16, -1.0],
        [24, 0],
        [14, 1.2],
        [14, -1.2],
        [20, 0],
        [16, 1.8],
      ],
    },
    { gap: 10, drop: 1.2 },
    {
      steps: [
        [14, -0.8],
        [22, 0],
        [16, 1.0],
        [16, -1.0],
        [24, 0],
        [16, 1.6],
      ],
    },
    { gap: 9, drop: 1.0 },
    {
      steps: [
        [14, -0.8],
        [26, 0],
        [14, 1.2],
        [14, -1.2],
        [20, 1.4],
        [20, -1.4],
        [24, 0],
        [18, 1.0],
        [18, -1.0],
        [110, 0],
      ],
    },
  ]),
  start: { x: 0, y: 0.6 },
  finishX: 800,
  // Tuesday: the sea is the hazard, so it is drawn as one instead of being left to killY. The water sits
  // in the gaps the track already has - coming up short was always fatal here; now it looks fatal too.
  // The sea fills the holes the track already has: shallow, because on this map the water sits just under
  // the sand and coming up short is meant to end the run immediately.
  gapHazard: { art: 'water', depth: 0.8 },
  ramps: [{ x: 360, width: 5, height: 1.1, art: 'wood' }],
  fuelCans: [
    { x: 140, refill: 6 },
    { x: 330, refill: 6 },
    { x: 560, refill: 8 },
    { x: 700, refill: 6 },
  ],
  // Water, not a canyon floor: a metre and a half under the lowest sand.
  killY: -3.5,
});

/**
 * Map 3 — WED, difficulty 2. "Roots, logs and long jumps between the pines."
 * Choppy ground: many short, sharp bumps that bounce the bike and make the long jumps harder to set up
 * cleanly, because the rider arrives at each ramp already unsettled.
 */
export const EMERALD_WOODS: Level = defineLevel({
  id: 'emerald-woods',
  ground: buildTrack(-6, 0, [
    {
      steps: [
        [24, 0],
        [6, 0.5], // roots: short and sharp, unlike Sunset Canyon's long rollers
        [6, -0.5],
        [5, 0.6],
        [5, -0.6],
        [14, 0],
        [6, 0.7],
        [6, -0.7],
        [18, 0],
        [16, 1.8],
      ],
    },
    { gap: 11, drop: 1.2 },
    {
      steps: [
        [14, -0.8],
        [6, 0.6],
        [6, -0.6],
        [16, 0],
        [7, 0.8],
        [7, -0.8],
        [20, 0],
        [18, 2.2],
      ],
    },
    { gap: 13, drop: 1.5 },
    {
      steps: [
        [16, -1.0],
        [20, 0],
        [6, 0.6],
        [6, -0.6],
        [18, 0],
        [16, 1.8],
      ],
    },
    { gap: 12, drop: 1.3 },
    {
      steps: [
        [16, -0.9],
        [22, 0],
        [6, 0.5],
        [6, -0.5],
        [18, 0],
        [16, 1.8],
      ],
    },
    { gap: 11, drop: 1.2 },
    {
      steps: [
        [14, -0.8],
        [6, 0.6],
        [6, -0.6],
        [20, 0],
        [16, 1.6],
      ],
    },
    { gap: 10, drop: 1.1 },
    {
      steps: [
        [14, -0.8],
        [24, 0],
        [6, 0.5],
        [6, -0.5],
        [22, 0],
        [6, 0.6],
        [6, -0.6],
        [16, 1.2],
        [16, -1.2],
        [24, 0],
        [110, 0],
      ],
    },
  ]),
  start: { x: 0, y: 0.6 },
  finishX: 695,
  // Wednesday is kickers between the pines.
  //
  // A log across the track was tried here and taken out again. Pairing a kicker with a wall only works if
  // the rider arrives at the speed the jump was measured at, and on terrain with hills they do not: the
  // same ramp that clears a container on the flat leaves them 40 cm short on a climb. Until obstacle
  // placement can be checked against the speed actually carried into it, walls stay off the maps - see the
  // trajectory table in obstacles.test.ts for what a jump really buys.
  fuelCans: [
    { x: 150, refill: 6 },
    { x: 300, refill: 8 },
    { x: 520, refill: 8 },
  ],
  killY: -12,
});

/**
 * Map 4 — THU, difficulty 3. "Cranes, containers and tight landings."
 * Flat container tops at different heights. The gaps are deliberately NOT wide; the difficulty is that each
 * landing strip is short, so overshooting drops the rider into the next gap instead of giving them room to
 * recover — and the tops with no kicker of their own are followed by narrow gaps, because there is no ramp to
 * launch from. Two of them land HIGHER than the takeoff, so coming in short hits a wall.
 *
 * The three long "dock" straights exist for a reason found the hard way: a chain of short tops is only
 * clearable while the rider is CARRYING speed, so a checkpoint inside that chain is a death trap — respawning
 * with 16 m of run-up in front of a 12 m gap cannot be cleared from a standstill, and the first version of
 * this map locked itself unfinishable after a single crash. Every checkpoint sits at the start of a dock.
 */
export const STEEL_YARD: Level = defineLevel({
  id: 'steel-yard',
  ground: buildTrack(-6, 0, [
    {
      steps: [
        [48, 0],
        [14, 2.4],
      ],
    }, // dock 1
    { gap: 11, drop: 1.2 },
    {
      steps: [
        [10, -0.8],
        [16, 2.2],
      ],
    }, // short top with a kicker
    { gap: 12, drop: 1.0 },
    { steps: [[22, 0]] }, // flat top, no kicker at all
    { gap: 9, drop: -0.6 }, // so this gap is narrow, and the far side is HIGHER
    {
      steps: [
        [14, -0.6],
        [44, 0],
        [14, 2.2],
      ],
    }, // dock 2: somewhere to restart from
    { gap: 12, drop: 1.2 },
    {
      steps: [
        [10, -0.8],
        [14, 2.0],
      ],
    },
    { gap: 11, drop: 0.8 },
    { steps: [[24, 0]] }, // flat again
    { gap: 9, drop: -0.5 },
    {
      steps: [
        [14, -0.8],
        [46, 0],
        [14, 2.2],
      ],
    }, // dock 3
    { gap: 12, drop: 1.4 },
    {
      steps: [
        [16, -1.0],
        [24, 0],
        [14, 1.2],
        [14, -1.2],
        [22, 0],
        [16, 1.2],
        [16, -1.2],
        [26, 0],
        [14, 1.0],
        [14, -1.0],
        [110, 0],
      ],
    },
  ]),
  start: { x: 0, y: 0.6 },
  finishX: 625,
  // Thursday is the yard: metal kickers, and the fuel discipline of a shorter track taken flat out.
  ramps: [
    { x: 170, width: 5, height: 1.3, art: 'metal' },
    { x: 390, width: 5, height: 1.2, art: 'metal' },
  ],
  fuelCans: [
    { x: 110, refill: 6 },
    { x: 300, refill: 8 },
    { x: 500, refill: 6 },
  ],
  killY: -13,
});

/**
 * Map 5 — FRI, difficulty 4. "Hot rock. Cold nerves."
 * Narrow ledges over gaps at the edge of what the bike can carry, reached off ramps steep enough that it
 * leaves them rotating — the rider has to straighten up with LEAN in mid-air or land on their back. The
 * opening runway is long on purpose: a 14 m gap from a standing start needs every metre of it.
 */
export const MAGMA_RIDGE: Level = defineLevel({
  id: 'magma-ridge',
  ground: buildTrack(-6, 0, [
    {
      steps: [
        [62, 0],
        [12, 2.4],
      ],
    }, // 14 m from standstill is only possible with a runway this long
    { gap: 14, drop: 1.6 },
    {
      steps: [
        [18, -1.2],
        [12, 2.6],
      ],
    }, // steep: the bike leaves this one rotating
    { gap: 13, drop: 1.4 },
    {
      steps: [
        [16, -1.0],
        [10, 2.4],
      ],
    },
    { gap: 12, drop: 1.6 },
    {
      steps: [
        [20, -1.2],
        [44, 0],
        [12, 2.6],
      ],
    }, // a ledge long enough to restart from
    { gap: 13, drop: 1.5 },
    {
      steps: [
        [18, -1.0],
        [12, 2.4],
      ],
    },
    { gap: 13, drop: 1.2 },
    {
      steps: [
        [20, -1.0],
        [46, 0],
        [14, 2.4],
      ],
    }, // and another
    { gap: 13, drop: 1.5 },
    {
      steps: [
        [18, -1.0],
        [24, 0],
        [12, 2.4],
      ],
    },
    { gap: 12, drop: 1.4 },
    {
      steps: [
        [18, -1.0],
        [28, 0],
        [16, 1.2],
        [16, -1.2],
        [24, 0],
        [18, 1.4],
        [18, -1.4],
        [26, 0],
        [16, 1.2],
        [16, -1.2],
        [120, 0],
      ],
    },
  ]),
  start: { x: 0, y: 0.6 },
  finishX: 735,
  // Friday: the gaps are lava, which changes nothing mechanically and everything about how they read.
  gapHazard: { art: 'lava', depth: 2.4, thickness: 2.4 },
  ramps: [
    { x: 210, width: 5, height: 1.3, art: 'dirt' },
    { x: 450, width: 5, height: 1.2, art: 'dirt' },
  ],
  fuelCans: [
    { x: 160, refill: 8 },
    { x: 380, refill: 8 },
    { x: 620, refill: 8 },
  ],
  killY: -16,
});

/**
 * Map 6 — SAT, difficulty 4. "Slippery slopes and huge air."
 * The only map with reduced ground friction. Measured honestly, ice does NOT lower the top speed the bike can
 * reach on a long runway — it lowers how quickly it gets there and how well it stops. So the map is built
 * around that: every approach is long (it has to be), and a crash is expensive because clawing the speed back
 * on a slippery climb takes far longer than it would anywhere else.
 */
export const FROST_PEAK: Level = defineLevel({
  id: 'frost-peak',
  ground: buildTrack(-6, 0, [
    {
      steps: [
        [66, 0], // a long runway, because on ice reaching speed takes distance, not grip
        [18, 2.4],
      ],
    },
    { gap: 13, drop: 1.4 },
    {
      steps: [
        [20, -1.0],
        [28, 0],
        [18, 2.4],
      ],
    },
    { gap: 13, drop: 1.6 },
    {
      steps: [
        [22, -1.2],
        [26, 0],
        [16, 2.2],
      ],
    },
    { gap: 12, drop: 1.5 },
    {
      steps: [
        [20, -1.0],
        [30, 0],
        [18, 2.2],
      ],
    },
    { gap: 12, drop: 1.3 },
    {
      steps: [
        [22, -1.2],
        [30, 0],
        [18, 2.2],
      ],
    },
    { gap: 12, drop: 1.4 },
    {
      steps: [
        [20, -1.0],
        [34, 0],
        [18, 2.0],
      ],
    },
    { gap: 12, drop: 1.3 },
    {
      steps: [
        [22, -1.2],
        [30, 0],
        [18, 1.4],
        [18, -1.4],
        [26, 0],
        [20, 1.4],
        [20, -1.4],
        [28, 0],
        [18, 1.2],
        [18, -1.2],
        [120, 0],
      ],
    },
  ]),
  start: { x: 0, y: 0.6 },
  finishX: 795,
  // Saturday is the long, slippery one, so the pressure here is the TANK: 795 m on ice takes longer than
  // anywhere else, and the cans are placed far enough apart that missing one is felt.
  ramps: [
    { x: 240, width: 6, height: 1.2, art: 'wood' },
    { x: 520, width: 6, height: 1.1, art: 'wood' },
  ],
  fuelCans: [
    { x: 130, refill: 8 },
    { x: 330, refill: 8 },
    { x: 540, refill: 8 },
    { x: 700, refill: 8 },
  ],
  killY: -15,
  // Ice. Enough grip to move, not enough to drive out of a mistake.
  groundFriction: 0.45,
});

/**
 * Map 7 — SUN, difficulty 5. "The final race of the week."
 * Everything the week taught, in one track: Emerald Woods' chop, Steel Yard's short landings and flat tops
 * with no kicker, Magma Ridge's steep ramps and ceiling-height gaps, and the longest run of the seven.
 */
export const ORBIT_CIRCUIT: Level = defineLevel({
  id: 'orbit-circuit',
  ground: buildTrack(-6, 0, [
    {
      steps: [
        [56, 0],
        [6, 0.6], // chop, right where the rider is trying to settle for the first big gap
        [6, -0.6],
        [14, 0],
        [12, 2.4],
      ],
    },
    { gap: 14, drop: 1.6 },
    {
      steps: [
        [18, -1.0],
        [20, 0],
      ],
    }, // flat top, no kicker
    // A step DOWN, not a jump: a flat lip gives no lift, so the bike simply falls ~1.1 m while crossing 8 m.
    // The far side has to be lower than that or the rider lands on the wall — at drop 0.4 it always did.
    { gap: 8, drop: 1.8 },
    {
      steps: [
        [16, -0.8],
        [12, 2.4],
      ],
    },
    { gap: 13, drop: 1.6 },
    {
      steps: [
        [18, -1.0],
        [6, 0.6],
        [6, -0.6],
        [18, 0],
        [12, 2.6],
      ],
    },
    { gap: 14, drop: 1.8 },
    {
      steps: [
        [20, -1.2],
        [22, 0],
        [14, 2.2],
      ],
    },
    { gap: 13, drop: 1.6 }, // a 13 m gap has to land at least ~1.4 m lower: the bike drops that far crossing it
    // Land, settle, THEN climb. A 10 m landing running straight into a 2.4-over-16 kicker crashed the rider
    // every single time: there is no control authority to straighten up and climb at once.
    {
      steps: [
        [14, -0.8],
        [22, 0],
        [14, 2.2],
      ],
    },
    { gap: 13, drop: 1.4 },
    {
      steps: [
        [18, -1.0],
        [6, 0.6],
        [6, -0.6],
        [22, 0],
        [12, 2.4],
      ],
    }, // chop, then the last steep launch
    { gap: 13, drop: 1.6 },
    {
      steps: [
        [16, -0.8],
        [24, 0],
        [14, 2.2],
      ],
    },
    { gap: 14, drop: 1.8 }, // the widest gap of the week, last
    {
      steps: [
        [20, -1.0],
        [26, 0],
        [16, 1.4],
        [16, -1.4],
        [24, 0],
        [130, 0],
      ],
    },
  ]),
  start: { x: 0, y: 0.6 },
  finishX: 740,
  // Sunday is the week's exam: three kickers, lava under the last one, and cans spread thin enough that
  // the tank is part of the problem.
  gapHazard: { art: 'lava', depth: 2.6, thickness: 2.4 },
  fuelCans: [
    { x: 120, refill: 6 },
    { x: 320, refill: 8 },
    { x: 500, refill: 8 },
    { x: 680, refill: 6 },
  ],
  killY: -18,
});

/** Metadata the UI needs, kept next to the level it describes. Mirrors `design/art/manifest.json`. */
export interface MapEntry {
  /** 1-7, and also the day of the week it opens on (1 = Monday). */
  readonly number: number;
  readonly day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
  readonly name: string;
  readonly tagline: string;
  /** 1 (easiest) to 5, as shown in the map list. */
  readonly difficulty: number;
  /** Theme colour from the art manifest, used for the map's own accents. */
  readonly accent: string;
  readonly level: Level;
}

export const MAPS: readonly MapEntry[] = [
  {
    number: 1,
    day: 'MON',
    name: 'Sunset Canyon',
    tagline: 'Speed through the rocks. Master the jumps. Beat the clock.',
    difficulty: 1,
    accent: '#ff8a3a',
    level: SUNSET_CANYON,
  },
  {
    number: 2,
    day: 'TUE',
    name: 'Coral Coast',
    tagline: 'Ride the shoreline. Do not touch the water.',
    difficulty: 2,
    accent: '#3ad0e0',
    level: CORAL_COAST,
  },
  {
    number: 3,
    day: 'WED',
    name: 'Emerald Woods',
    tagline: 'Roots, logs and long jumps between the pines.',
    difficulty: 2,
    accent: '#3aa07a',
    level: EMERALD_WOODS,
  },
  {
    number: 4,
    day: 'THU',
    name: 'Steel Yard',
    tagline: 'Cranes, containers and tight landings.',
    difficulty: 3,
    accent: '#7a8aff',
    level: STEEL_YARD,
  },
  {
    number: 5,
    day: 'FRI',
    name: 'Magma Ridge',
    tagline: 'Hot rock. Cold nerves.',
    difficulty: 4,
    accent: '#ff5a2a',
    level: MAGMA_RIDGE,
  },
  {
    number: 6,
    day: 'SAT',
    name: 'Frost Peak',
    tagline: 'Slippery slopes and huge air.',
    difficulty: 4,
    accent: '#8ac8ff',
    level: FROST_PEAK,
  },
  {
    number: 7,
    day: 'SUN',
    name: 'Orbit Circuit',
    tagline: 'The final race of the week.',
    difficulty: 5,
    accent: '#a06ad8',
    level: ORBIT_CIRCUIT,
  },
];

/** Looks up a map by its 1-7 number. */
export function mapByNumber(number: number): MapEntry | undefined {
  return MAPS.find((entry) => entry.number === number);
}
