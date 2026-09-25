import {
  createBikeSimulation,
  TICK_SECONDS,
  type BikeState,
  type Level,
} from '@worldrush/game-core';
import { Application, Container, Graphics } from 'pixi.js';
import { createInputTracker, type InputTracker } from './input';
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

const COLOUR = {
  ground: 0x2c3350,
  groundLine: 0x6f7bb0,
  chassis: 0xffc247,
  wheel: 0x11131f,
  wheelSpoke: 0x6f7bb0,
  checkpoint: 0x49d0a0,
  finish: 0xff5d73,
  crashed: 0xff5d73,
} as const;

export interface GameHandle {
  /** The current simulation state, for a HUD to poll. */
  getState(): BikeState;
  /** Wires an on-screen control button to an INPUT flag. */
  bindButton(element: HTMLElement, flag: number): void;
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
  const simulation = createBikeSimulation(engine, level);

  const app = new Application();
  await app.init({
    resizeTo: parent,
    backgroundColor: 0x0b1020,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
  });
  parent.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);
  world.addChild(drawLevel(level));

  const bike = createBikeSprite();
  world.addChild(bike.root);

  const input: InputTracker = createInputTracker();

  let accumulatorMs = 0;
  const onTick = (): void => {
    accumulatorMs += app.ticker.elapsedMS;
    const tickMs = TICK_SECONDS * 1000;
    let ticks = Math.floor(accumulatorMs / tickMs);
    accumulatorMs -= ticks * tickMs;
    if (ticks > MAX_TICKS_PER_FRAME) ticks = MAX_TICKS_PER_FRAME;

    if (ticks > 0) {
      const mask = input.getMask();
      for (let i = 0; i < ticks; i++) simulation.step(mask);
      onState?.(simulation.getState());
    }

    render(simulation.getState());
  };

  function render(state: BikeState): void {
    bike.root.position.set(state.x * PIXELS_PER_METRE, -state.y * PIXELS_PER_METRE);
    bike.root.rotation = -state.angle;
    bike.rearWheel.rotation = -state.rearWheelAngle;
    bike.frontWheel.rotation = -state.frontWheelAngle;
    bike.chassis.tint = state.crashed ? COLOUR.crashed : 0xffffff;

    world.position.set(
      app.screen.width * CAMERA_ANCHOR_X - state.x * PIXELS_PER_METRE,
      app.screen.height * CAMERA_ANCHOR_Y + state.y * PIXELS_PER_METRE,
    );
  }

  render(simulation.getState());
  app.ticker.add(onTick);

  return {
    getState: () => simulation.getState(),
    bindButton: (element, flag) => input.bindButton(element, flag),
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
function drawLevel(level: Level): Container {
  const container = new Container();
  const points = level.ground.map(([x, y]): [number, number] => [
    x * PIXELS_PER_METRE,
    -y * PIXELS_PER_METRE,
  ]);

  // Each ground span is filled down to a skirt below the lowest point so the track reads as solid earth.
  const lowest = Math.max(...points.map(([, y]) => y)) + 6 * PIXELS_PER_METRE;
  const surface = new Graphics();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    surface
      .poly([a[0], a[1], b[0], b[1], b[0], lowest, a[0], lowest])
      .fill(COLOUR.ground)
      .moveTo(a[0], a[1])
      .lineTo(b[0], b[1])
      .stroke({ width: 3, color: COLOUR.groundLine });
  }
  container.addChild(surface);

  const markers = new Graphics();
  for (const checkpointX of level.checkpoints) {
    const x = checkpointX * PIXELS_PER_METRE;
    markers
      .moveTo(x, 0)
      .lineTo(x, -3 * PIXELS_PER_METRE)
      .stroke({ width: 3, color: COLOUR.checkpoint, alpha: 0.8 });
  }
  const finishX = level.finishX * PIXELS_PER_METRE;
  markers
    .moveTo(finishX, 0)
    .lineTo(finishX, -3 * PIXELS_PER_METRE)
    .stroke({ width: 5, color: COLOUR.finish });
  container.addChild(markers);

  return container;
}

interface BikeSprite {
  root: Container;
  chassis: Graphics;
  rearWheel: Container;
  frontWheel: Container;
}

/**
 * Placeholder primitives matching `bike-sim.ts`'s collision shapes, deliberately not the real art: this is a
 * physics/controls spike, and drawing the actual bodies makes tuning problems visible.
 */
function createBikeSprite(): BikeSprite {
  const root = new Container();

  const chassis = new Graphics();
  const halfLength = 0.45 * PIXELS_PER_METRE;
  const radius = 0.3 * PIXELS_PER_METRE;
  chassis
    .roundRect(-halfLength - radius, -radius, (halfLength + radius) * 2, radius * 2, radius)
    .fill(COLOUR.chassis);
  root.addChild(chassis);

  const rearWheel = createWheel();
  rearWheel.position.set(-0.55 * PIXELS_PER_METRE, 0.35 * PIXELS_PER_METRE);
  const frontWheel = createWheel();
  frontWheel.position.set(0.55 * PIXELS_PER_METRE, 0.35 * PIXELS_PER_METRE);
  root.addChild(rearWheel, frontWheel);

  return { root, chassis, rearWheel, frontWheel };
}

function createWheel(): Container {
  const wheel = new Container();
  const radius = 0.4 * PIXELS_PER_METRE;
  const graphics = new Graphics();
  graphics
    .circle(0, 0, radius)
    .fill(COLOUR.wheel)
    .circle(0, 0, radius)
    .stroke({ width: 3, color: COLOUR.wheelSpoke })
    // A single spoke: without it a spinning circle looks stationary.
    .moveTo(0, 0)
    .lineTo(0, -radius)
    .stroke({ width: 3, color: COLOUR.wheelSpoke });
  wheel.addChild(graphics);
  return wheel;
}
