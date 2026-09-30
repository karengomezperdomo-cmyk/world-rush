import {
  createBikeSimulation,
  groundYAt,
  hasInput,
  INPUT,
  TICK_SECONDS,
  type BikeState,
  type InputMask,
  type Level,
} from '@worldrush/game-core';
import { Application, Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { createEffects, type EffectTextures } from './effects';
import { createInputTracker, type InputTracker } from './input';
import { createScenery, themeFor, type MapTheme } from './scenery';
import { loadPhysicsEngine } from './physics-loader';

const PIXELS_PER_METRE = 56;
/** Where the bike sits horizontally on screen, as a fraction of width, so the track ahead stays visible. */
const CAMERA_ANCHOR_X = 0.32;
const CAMERA_ANCHOR_Y = 0.62;
/**
 * If the tab is backgrounded the ticker stops and `elapsedMS` returns one huge delta on return. Simulating
 * every one of those ticks would freeze the frame, so drop the backlog past this many ticks — the run is
 * ruined for leaderboard purposes anyway, which Phase 7's server-side replay check is what actually enforces.
 */
const MAX_TICKS_PER_FRAME = 8;
/** How far below the lowest ground point the filled "earth" extends, so gaps read as deep, not thin. */
const GROUND_SKIRT_METRES = 8;

/** Thickness of the coloured band along the top of the ground: grass, sand, snow, crust. */
const SURFACE_METRES = 0.32;
/**
 * Climb steeper than this is drawn as a BUILT ramp rather than as earth — planks and a lit lip.
 * 0.11 is about 6 degrees, which is where the maps' takeoffs start (a 2 m rise over 16 m is 0.125) and
 * comfortably above the rolling terrain in between, so hills do not sprout scaffolding.
 */
const RAMP_SLOPE = 0.11;
/**
 * ...and it must be a real run-up, not a bump. Emerald Woods' roots are 6 m long at slope 0.117, which
 * clears the angle test on its own and had them sprouting plank ramps; the maps' actual takeoffs are
 * 10-20 m.
 */
const RAMP_MIN_RUN_METRES = 9;

/**
 * The provisional art is pixel art authored at 20 art-pixels per physics metre: `design/art/bike/ride.png`
 * is 40x30 and its wheel centres sit 22 px apart, which is the bike's real 1.10 m wheelbase
 * (`bike-sim.ts` puts the wheels at ±0.55 m). Everything below follows from that one measurement.
 */
const ART_PIXELS_PER_METRE = 20;
const ART_SCALE = PIXELS_PER_METRE / ART_PIXELS_PER_METRE;
/**
 * Where the chassis body's origin sits inside the 40x30 bike sprite, as a 0-1 anchor. Horizontally it is
 * the midpoint of the two wheels (x=20). Vertically the wheels are drawn at y=21 and the physics puts them
 * 0.35 m below the chassis centre, i.e. 7 art pixels, so the chassis centre is y=14.
 */
const BIKE_ANCHOR = { x: 20 / 40, y: 14 / 30 } as const;

/** Frames per wheel revolution-sixth. See tools/art/generate.mjs for why four covers the cycle. */
const SPIN_FRAME_COUNT = 4;
/**
 * How much wheel rotation the four frames are spread across.
 *
 * The art itself repeats every 60 degrees (tread blocks every 30, alternating; spokes every 60), so a sixth
 * of a turn is the physically honest answer — and it strobes. At 18 m/s the wheel turns about 49 degrees per
 * tick, nearly a whole art period, so consecutive frames land almost anywhere: measured, the sequence came
 * out 0 3 1 0 2 0 3 1, which reads as random flicker rather than rotation. This is the wagon-wheel effect,
 * and no choice of four frames can beat the sampling rate.
 *
 * So the frames are deliberately geared down over a full turn instead. The wheel then advances about half a
 * frame per tick at top speed and always cycles forwards. It is a cosmetic lie about how fast the tread is
 * moving, told to avoid a much more distracting one.
 */
const SPIN_PERIOD_RADIANS = Math.PI * 2;
/** How long the ragdoll takes to tumble through its four frames after a crash. */
const RAGDOLL_FRAME_MS = 90;
/**
 * Metres above the ground within which the bike counts as riding on it, for dust.
 *
 * Measured, not guessed: riding Sunset Canyon headless, the chassis sits 0.63-0.72 m above the surface,
 * and rises past 1.37 m as soon as it is airborne. 0.95 sits clearly between the two. The first attempt used
 * 0.75, which is inside the riding range itself, so dust fired on roughly every other frame and read as a
 * glitch rather than as a wheel biting.
 */
const GROUNDED_TOLERANCE_METRES = 0.95;
/** How long each frame of the marshal's wave holds. */
const MARSHAL_WAVE_MS = 190;
/** Dust is thrown at most this often; any faster and it is a solid smear rather than puffs. */
const DUST_INTERVAL_MS = 85;
/** Below this speed the wheel is not biting hard enough to throw anything up. */
const DUST_MIN_SPEED = 3.5;
/** How long the camera keeps shaking after an impact, and how far it throws the view at its worst. */
const SHAKE_MS = 420;
const SHAKE_PIXELS = 13;

const POSES = ['ride', 'leanBack', 'leanForward'] as const;
type Pose = (typeof POSES)[number];

const POSE_FILES: Record<Pose, string> = {
  ride: 'ride',
  leanBack: 'lean-back',
  leanForward: 'lean-forward',
};

export interface GameHandle {
  /** The current simulation state, for a HUD to poll. */
  getState(): BikeState;
  /** Wires an on-screen control button to an INPUT flag. */
  bindButton(element: HTMLElement, flag: number): void;
  /**
   * Stops advancing the simulation. The run's clock is the simulation's own tick count, so a paused game
   * genuinely stops timing — which is why the pause screen has to say out loud that the DAILY deadline keeps
   * running regardless.
   */
  pause(): void;
  resume(): void;
  /** Throws the current run away and starts the same level again from tick zero. */
  restart(): void;
  destroy(): void;
}

export interface StartGameOptions {
  /** Element the canvas is appended to. Sized to this element. */
  parent: HTMLElement;
  level: Level;
  /** Called after every simulation tick, for HUD updates. */
  onState?: (state: BikeState) => void;
}

export async function startGame({ parent, level, onState }: StartGameOptions): Promise<GameHandle> {
  const engine = await loadPhysicsEngine();
  // Reassigned by restart(), which throws the old world away rather than trying to rewind it.
  let simulation = createBikeSimulation(engine, level);

  const theme = themeFor(level.id);
  const app = new Application();
  await app.init({
    resizeTo: parent,
    // Only ever visible for the frame before the sky sprite is sized; keeping it in the theme's palette
    // means even that frame is the right colour.
    backgroundColor: Number.parseInt(theme.skyTop.slice(1), 16),
    // Off on purpose: the art is pixel art, and antialiasing it just makes it muddy.
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio,
  });
  parent.appendChild(app.canvas);

  const textures = await loadBikeTextures();

  // Behind everything: sky, then two ridges that scroll at a fraction of the camera's speed.
  const scenery = createScenery(theme);
  app.stage.addChild(scenery.container);

  const world = new Container();
  app.stage.addChild(world);
  const levelView = drawLevel(level, theme, textures.marshal[0]!);
  world.addChild(levelView.container);

  const bike = createBikeSprite(textures.poses.ride[0]!);
  world.addChild(bike);

  // Added after the bike so dust and debris sit in front of it.
  const effects = createEffects(textures.effects);
  world.addChild(effects.container);
  let wasCrashed = false;
  let dustDueInMs = 0;
  let shakeLeftMs = 0;

  const input: InputTracker = createInputTracker();

  let accumulatorMs = 0;
  let paused = false;
  const onTick = (): void => {
    if (paused) {
      // Drop the elapsed time on the floor instead of banking it: otherwise resuming would fast-forward
      // through every tick the player spent reading the pause screen.
      render(simulation.getState(), 0);
      return;
    }
    accumulatorMs += app.ticker.elapsedMS;
    const tickMs = TICK_SECONDS * 1000;
    let ticks = Math.floor(accumulatorMs / tickMs);
    accumulatorMs -= ticks * tickMs;
    if (ticks > MAX_TICKS_PER_FRAME) ticks = MAX_TICKS_PER_FRAME;

    let heldInput: InputMask = 0;
    if (ticks > 0) {
      heldInput = input.getMask();
      for (let i = 0; i < ticks; i++) simulation.step(heldInput);
      onState?.(simulation.getState());
    }

    render(simulation.getState(), heldInput);
  };

  function render(state: BikeState, held: InputMask): void {
    scenery.update(state.x * PIXELS_PER_METRE, app.screen.width, app.screen.height);
    updateEffects(state, held, app.ticker.deltaMS);
    bike.texture = pickBikeTexture(textures, state, held);
    bike.position.set(state.x * PIXELS_PER_METRE, -state.y * PIXELS_PER_METRE);
    bike.rotation = -state.angle;

    let shakeX = 0;
    let shakeY = 0;
    if (shakeLeftMs > 0) {
      shakeLeftMs = Math.max(0, shakeLeftMs - app.ticker.deltaMS);
      // Decays as it goes, so the hit lands hard and settles instead of rattling at a constant amplitude.
      const strength = (shakeLeftMs / SHAKE_MS) ** 2 * SHAKE_PIXELS;
      shakeX = (Math.random() * 2 - 1) * strength;
      shakeY = (Math.random() * 2 - 1) * strength;
    }

    world.position.set(
      app.screen.width * CAMERA_ANCHOR_X - state.x * PIXELS_PER_METRE + shakeX,
      app.screen.height * CAMERA_ANCHOR_Y + state.y * PIXELS_PER_METRE + shakeY,
    );
  }

  function updateEffects(state: BikeState, held: InputMask, deltaMs: number): void {
    const rearX = (state.x - 0.55) * PIXELS_PER_METRE;
    const wheelY = -(state.y - 0.35) * PIXELS_PER_METRE;

    if (state.crashed && !wasCrashed) {
      const crashX = state.x * PIXELS_PER_METRE;
      const crashY = -state.y * PIXELS_PER_METRE;
      effects.explosion(crashX, crashY, ART_SCALE);
      // Debris thrown out sideways, so the impact scatters rather than just flashing in place.
      for (let piece = 0; piece < 5; piece++) {
        const spread = (piece / 4 - 0.5) * 2;
        effects.dust(
          crashX + spread * 0.5 * PIXELS_PER_METRE,
          crashY,
          spread * 2.6,
          ART_SCALE * (0.7 + Math.abs(spread) * 0.4),
        );
      }
      shakeLeftMs = SHAKE_MS;
    }
    // Respawn: clear the wreckage rather than leave a puff hanging where the bike used to be.
    if (wasCrashed && !state.crashed) effects.clear();
    wasCrashed = state.crashed;

    dustDueInMs -= deltaMs;
    const groundY = groundYAt(level, state.x);
    const grounded =
      groundY !== undefined && state.y - groundY < GROUNDED_TOLERANCE_METRES && !state.crashed;
    const driving = hasInput(held, INPUT.GAS) || hasInput(held, INPUT.BRAKE);
    if (grounded && driving && Math.abs(state.vx) > DUST_MIN_SPEED && dustDueInMs <= 0) {
      dustDueInMs = DUST_INTERVAL_MS;
      // Thrown backwards, against the direction of travel.
      effects.dust(rearX, wheelY, -Math.sign(state.vx) * 1.6, ART_SCALE);
    }

    // Every marshal the rider has already passed throws her arms up and waves; the rest wait, arms down.
    const wave = 1 + (Math.floor(performance.now() / MARSHAL_WAVE_MS) % 2);
    for (let index = 0; index < levelView.marshals.length; index++) {
      const passed = index <= state.checkpointIndex;
      levelView.marshals[index]!.texture = textures.marshal[passed ? wave : 0]!;
    }

    effects.update(deltaMs);
  }

  render(simulation.getState(), 0);
  app.ticker.add(onTick);

  return {
    getState: () => simulation.getState(),
    bindButton: (element, flag) => input.bindButton(element, flag),
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      accumulatorMs = 0;
    },
    restart() {
      effects.clear();
      wasCrashed = false;
      shakeLeftMs = 0;
      simulation.dispose();
      simulation = createBikeSimulation(engine, level);
      accumulatorMs = 0;
      paused = false;
      const state = simulation.getState();
      onState?.(state);
      render(state, 0);
    },
    destroy() {
      app.ticker.remove(onTick);
      input.dispose();
      // `true` also removes the canvas from the DOM.
      app.destroy(true, { children: true });
      simulation.dispose();
    },
  };
}

/** Ground, checkpoints and finish line. Static: drawn once, moved by the camera. */
interface LevelView {
  readonly container: Container;
  /** One per checkpoint, in order, so index N is checkpoint N. */
  readonly marshals: Sprite[];
}

function drawLevel(level: Level, theme: MapTheme, marshalTexture: Texture): LevelView {
  const container = new Container();
  const toScreen = ([x, y]: readonly [number, number]): [number, number] => [
    x * PIXELS_PER_METRE,
    -y * PIXELS_PER_METRE,
  ];

  // Each ground span is filled down to a skirt below the lowest point so the track reads as solid earth.
  // The skirt is shared across strips so they sit on a common floor instead of floating at different
  // depths — but nothing is drawn BETWEEN strips, so the gaps read as real holes.
  const lowestMetres = Math.min(...level.ground.flat().map(([, y]) => y)) - GROUND_SKIRT_METRES;
  const floor = -lowestMetres * PIXELS_PER_METRE;

  const surface = new Graphics();
  for (const groundStrip of level.ground) {
    for (let i = 0; i < groundStrip.length - 1; i++) {
      const a = groundStrip[i];
      const b = groundStrip[i + 1];
      if (!a || !b) continue;
      const run = b[0] - a[0];
      if (run <= 0) continue;
      // Rising only: a takeoff is a built thing, a landing slope is just ground.
      const isRamp = run >= RAMP_MIN_RUN_METRES && (b[1] - a[1]) / run > RAMP_SLOPE;
      const [ax, ay] = toScreen(a);
      const [bx, by] = toScreen(b);
      const band = SURFACE_METRES * PIXELS_PER_METRE;

      // Body, from the surface band down to the shared floor.
      surface
        .poly([ax, ay + band, bx, by + band, bx, floor, ax, floor])
        .fill(isRamp ? theme.ramp : theme.ground);

      // The band itself, which is what gives each map its footing at a glance.
      surface
        .poly([ax, ay, bx, by, bx, by + band, ax, ay + band])
        .fill(isRamp ? theme.rampEdge : theme.surface);

      if (isRamp) {
        // A takeoff is a built thing, so it is drawn as one: legs standing on the ground beneath it,
        // diagonal bracing between them, planks across the deck, and a lit lip at the very top. The rider
        // has to read "jump here" at speed, and a plain coloured wedge does not say that.
        const lengthPixels = Math.hypot(bx - ax, by - ay);
        const legs = Math.max(2, Math.round(lengthPixels / (2.2 * PIXELS_PER_METRE)));
        let previousLegX = ax;
        let previousLegY = ay + band;
        for (let leg = 1; leg <= legs; leg++) {
          const t = leg / legs;
          const px = ax + (bx - ax) * t;
          const py = ay + (by - ay) * t + band;
          // Upright, from the deck down to the shared floor.
          surface.moveTo(px, py).lineTo(px, floor).stroke({ width: 3, color: theme.ground, alpha: 0.85 });
          // Brace, running back to the foot of the previous upright.
          surface
            .moveTo(previousLegX, previousLegY)
            .lineTo(px, Math.min(floor, py + 2.2 * PIXELS_PER_METRE))
            .stroke({ width: 2, color: theme.ground, alpha: 0.5 });
          previousLegX = px;
          previousLegY = py;
        }

        const planks = Math.max(2, Math.floor(lengthPixels / (0.75 * PIXELS_PER_METRE)));
        for (let plank = 1; plank < planks; plank++) {
          const t = plank / planks;
          const px = ax + (bx - ax) * t;
          const py = ay + (by - ay) * t;
          // Alternating tone, so the deck reads as separate boards rather than as one hatched block.
          surface
            .moveTo(px, py)
            .lineTo(px, py + band)
            .stroke({
              width: 2,
              color: plank % 2 === 0 ? theme.ground : theme.rampEdge,
              alpha: plank % 2 === 0 ? 0.45 : 0.28,
            });
        }

        // The lip: a short bright kick at the very end of the ramp, where the wheels leave.
        surface
          .moveTo(bx - 0.5 * PIXELS_PER_METRE, by - 0.12 * PIXELS_PER_METRE)
          .lineTo(bx, by - 0.3 * PIXELS_PER_METRE)
          .stroke({ width: 4, color: theme.rampEdge });
      }
    }
  }
  container.addChild(surface);

  const markers = new Graphics();
  // A finish line really is a line, so it stays one. Checkpoints are people now.
  const finishX = level.finishX * PIXELS_PER_METRE;
  markers
    .moveTo(finishX, 0)
    .lineTo(finishX, -3 * PIXELS_PER_METRE)
    .stroke({ width: 5, color: theme.finish });
  container.addChild(markers);

  // The marshal stands at each checkpoint, on the ground rather than at a fixed height, so she is planted on
  // the surface whatever the terrain does there. Anchored at her feet for the same reason.
  const marshals = level.checkpoints.map((checkpointX) => {
    const sprite = new Sprite(marshalTexture);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(ART_SCALE);
    const groundY = groundYAt(level, checkpointX) ?? level.start.y;
    sprite.position.set(checkpointX * PIXELS_PER_METRE, -groundY * PIXELS_PER_METRE);
    container.addChild(sprite);
    return sprite;
  });

  return { container, marshals };
}

interface BikeTextures {
  /** Indexed by pose, then by wheel-spin frame. */
  readonly poses: Record<Pose, Texture[]>;
  readonly ragdoll: Texture[];
  readonly effects: EffectTextures;
  /** [arms down, arms up 0, arms up 1] — the checkpoint marshal. */
  readonly marshal: Texture[];
}

async function loadPixelTexture(url: string): Promise<Texture> {
  const texture = await Assets.load<Texture>(url);
  // Pixel art: 'linear' would blur it into mush at this scale. Set per texture rather than globally so
  // nothing else Pixi loads later is forced to the same filtering.
  texture.source.scaleMode = 'nearest';
  return texture;
}

async function loadFrames(urls: readonly string[]): Promise<Texture[]> {
  return Promise.all(urls.map(loadPixelTexture));
}

async function loadBikeTextures(): Promise<BikeTextures> {
  const frameIndices = Array.from({ length: SPIN_FRAME_COUNT }, (_, index) => index);
  const [ride, leanBack, leanForward, ragdoll, explosion, dust, marshal] = await Promise.all([
    ...POSES.map((pose) =>
      loadFrames(frameIndices.map((frame) => `/art/bike/${POSE_FILES[pose]}-${frame}.png`)),
    ),
    loadFrames(frameIndices.map((frame) => `/art/bike/ragdoll-${frame}.png`)),
    loadFrames(Array.from({ length: 6 }, (_, index) => `/art/fx/explosion-${index}.png`)),
    loadFrames(Array.from({ length: 4 }, (_, index) => `/art/fx/dust-${index}.png`)),
    loadFrames(['/art/marshal/idle.png', '/art/marshal/cheer-0.png', '/art/marshal/cheer-1.png']),
  ]);
  return {
    poses: { ride: ride!, leanBack: leanBack!, leanForward: leanForward! },
    ragdoll: ragdoll!,
    effects: { explosion: explosion!, dust: dust! },
    marshal: marshal!,
  };
}

function createBikeSprite(texture: Texture): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(BIKE_ANCHOR.x, BIKE_ANCHOR.y);
  sprite.scale.set(ART_SCALE);
  return sprite;
}

/**
 * The bike's current frame.
 *
 * While riding, the wheel frame comes from the rear wheel's ACTUAL rotation rather than from a timer, so the
 * wheels slow with the bike, stop when it stops, and spin backwards when it rolls back — none of which a
 * fixed-rate animation would do. While crashed, the ragdoll tumbles through its frames once and holds on the
 * last, which is what makes a crash read as an event rather than a pose.
 */
function pickBikeTexture(textures: BikeTextures, state: BikeState, held: InputMask): Texture {
  if (state.crashed) {
    const frame = Math.min(
      textures.ragdoll.length - 1,
      Math.floor((state.crashedTicksAgo * TICK_SECONDS * 1000) / RAGDOLL_FRAME_MS),
    );
    return textures.ragdoll[frame]!;
  }
  const pose: Pose = hasInput(held, INPUT.LEAN_BACK)
    ? 'leanBack'
    : hasInput(held, INPUT.LEAN_FORWARD)
      ? 'leanForward'
      : 'ride';
  const frames = textures.poses[pose];
  // Negated: rolling forwards is clockwise on screen, which Box2D reports as a DECREASING angle, while the
  // sprite frames are drawn at increasing spin. Without this the wheels turn backwards as the bike drives
  // forwards — smoothly, and wrongly.
  // Wrapped into one art period, keeping the result positive for negative angles.
  const turn = -state.rearWheelAngle % SPIN_PERIOD_RADIANS;
  const normalised = (turn + SPIN_PERIOD_RADIANS) % SPIN_PERIOD_RADIANS;
  const frame = Math.floor((normalised / SPIN_PERIOD_RADIANS) * frames.length) % frames.length;
  return frames[frame]!;
}
