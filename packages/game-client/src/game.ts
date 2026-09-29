import {
  createBikeSimulation,
  hasInput,
  INPUT,
  TICK_SECONDS,
  type BikeState,
  type InputMask,
  type Level,
} from '@worldrush/game-core';
import { Application, Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
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

const BIKE_TEXTURES = {
  ride: '/art/bike/ride.png',
  leanBack: '/art/bike/lean-back.png',
  leanForward: '/art/bike/lean-forward.png',
  crashed: '/art/bike/ragdoll-0.png',
} as const;

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
  world.addChild(drawLevel(level, theme));

  const bike = createBikeSprite(textures.ride);
  world.addChild(bike);

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
    bike.texture = pickBikeTexture(textures, state, held);
    bike.position.set(state.x * PIXELS_PER_METRE, -state.y * PIXELS_PER_METRE);
    bike.rotation = -state.angle;

    world.position.set(
      app.screen.width * CAMERA_ANCHOR_X - state.x * PIXELS_PER_METRE,
      app.screen.height * CAMERA_ANCHOR_Y + state.y * PIXELS_PER_METRE,
    );
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
function drawLevel(level: Level, theme: MapTheme): Container {
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
        // Planks across the ramp, so a takeoff reads as a structure and the rider can see it coming.
        const lengthPixels = Math.hypot(bx - ax, by - ay);
        const planks = Math.max(1, Math.floor(lengthPixels / (0.9 * PIXELS_PER_METRE)));
        for (let plank = 1; plank < planks; plank++) {
          const t = plank / planks;
          const px = ax + (bx - ax) * t;
          const py = ay + (by - ay) * t;
          surface
            .moveTo(px, py + band)
            .lineTo(px, py + band + 0.55 * PIXELS_PER_METRE)
            .stroke({ width: 2, color: theme.ground, alpha: 0.55 });
        }
      }
    }
  }
  container.addChild(surface);

  const markers = new Graphics();
  for (const checkpointX of level.checkpoints) {
    const x = checkpointX * PIXELS_PER_METRE;
    markers
      .moveTo(x, 0)
      .lineTo(x, -3 * PIXELS_PER_METRE)
      .stroke({ width: 3, color: theme.checkpoint, alpha: 0.8 });
  }
  const finishX = level.finishX * PIXELS_PER_METRE;
  markers
    .moveTo(finishX, 0)
    .lineTo(finishX, -3 * PIXELS_PER_METRE)
    .stroke({ width: 5, color: theme.finish });
  container.addChild(markers);

  return container;
}

type BikeTextures = Record<keyof typeof BIKE_TEXTURES, Texture>;

async function loadBikeTextures(): Promise<BikeTextures> {
  const entries = Object.entries(BIKE_TEXTURES) as [keyof typeof BIKE_TEXTURES, string][];
  const loaded = await Promise.all(
    entries.map(async ([name, url]) => {
      const texture = await Assets.load<Texture>(url);
      // Pixel art: 'linear' would blur it into mush at this scale. Set per texture rather than globally so
      // nothing else Pixi loads later is forced to the same filtering.
      texture.source.scaleMode = 'nearest';
      return [name, texture] as const;
    }),
  );
  return Object.fromEntries(loaded) as BikeTextures;
}

/** The provisional hero bike from `design/art/bike/`, aligned to the physics body via `BIKE_ANCHOR`. */
function createBikeSprite(texture: Texture): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(BIKE_ANCHOR.x, BIKE_ANCHOR.y);
  sprite.scale.set(ART_SCALE);
  return sprite;
}

/**
 * Swaps the bike frame to match what the rider is doing. Purely cosmetic — the physics never reads this, so
 * a wrong guess here can only ever look wrong, never change a run's outcome.
 */
function pickBikeTexture(textures: BikeTextures, state: BikeState, held: InputMask): Texture {
  if (state.crashed) return textures.crashed;
  if (hasInput(held, INPUT.LEAN_BACK)) return textures.leanBack;
  if (hasInput(held, INPUT.LEAN_FORWARD)) return textures.leanForward;
  return textures.ride;
}
