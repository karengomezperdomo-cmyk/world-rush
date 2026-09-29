import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';

/**
 * Backdrops and ground palettes, one per map.
 *
 * Before this, every map rendered identically: a flat purple sky and a maroon ground with an orange line on
 * top. The seven maps were only distinguishable on the menu, where each has its own hero art — once you were
 * riding, Frost Peak and Magma Ridge looked the same. This gives each one a sky, two parallax ridges and its
 * own ground and ramp colours.
 *
 * Everything is generated into a canvas at load time rather than shipped as image files. Two reasons: the
 * ridges must tile seamlessly across an 800 m track, which a hand-drawn strip does not do for free, and
 * World's Mini App guidelines put the initial load budget at 2-3 seconds, which is not the place to spend
 * a set of full-width backdrops per map.
 *
 * Seamlessness comes from the skyline being a sum of sine waves whose frequencies are whole numbers of
 * cycles across the tile: a periodic function repeats exactly, so the tile's right edge always meets its own
 * left edge. (`Math.sin` is fine here — the determinism lint that bans it applies to `game-core`, where the
 * simulation lives. Nothing in this file touches the simulation.)
 */

export type RidgeStyle = 'mesa' | 'waves' | 'pines' | 'towers' | 'peaks' | 'domes';

export interface MapTheme {
  /** Sky gradient, top to bottom. */
  readonly skyTop: string;
  readonly skyBottom: string;
  /** The distant ridge: moves least, so it reads as furthest away. */
  readonly farColour: string;
  readonly nearColour: string;
  readonly ridge: RidgeStyle;
  /** Solid earth under the surface. */
  readonly ground: number;
  /** The thin band along the top of the ground: grass, sand, snow, crust. */
  readonly surface: number;
  /** Steep segments are drawn as built ramps in this colour. */
  readonly ramp: number;
  readonly rampEdge: number;
  readonly checkpoint: number;
  readonly finish: number;
}

const DEFAULT_THEME: MapTheme = {
  skyTop: '#2b1b3d',
  skyBottom: '#ff8a3a',
  farColour: '#3a2340',
  nearColour: '#43263c',
  ridge: 'mesa',
  ground: 0x4a2d3a,
  surface: 0xff8a3a,
  ramp: 0x8a5a2a,
  rampEdge: 0xd9a05a,
  checkpoint: 0x49d0a0,
  finish: 0xff5d73,
};

/** Keyed by `Level.id`, so a map's look travels with its data. */
export const THEMES: Readonly<Record<string, MapTheme>> = {
  'sunset-canyon': DEFAULT_THEME,
  'coral-coast': {
    skyTop: '#0d3b6e',
    skyBottom: '#7fd0ec',
    farColour: '#4f97a6',
    nearColour: '#1c6a80',
    ridge: 'waves',
    ground: 0xc9a96a,
    surface: 0xf2d9a0,
    ramp: 0xa8703a,
    rampEdge: 0xe0b878,
    checkpoint: 0x2ee59d,
    finish: 0xff5d73,
  },
  'emerald-woods': {
    skyTop: '#0b2a26',
    skyBottom: '#8fd6b0',
    farColour: '#2b6b58',
    nearColour: '#1b4d3e',
    ridge: 'pines',
    ground: 0x2d4a2a,
    surface: 0x5f8f4a,
    ramp: 0x6b4a2a,
    rampEdge: 0xa8834a,
    checkpoint: 0x8ae87a,
    finish: 0xff5d73,
  },
  'steel-yard': {
    skyTop: '#0a1030',
    skyBottom: '#7f93c8',
    farColour: '#2b3a63',
    nearColour: '#1a2340',
    ridge: 'towers',
    ground: 0x2a2f42,
    surface: 0x7a8aff,
    ramp: 0x8a8f9a,
    rampEdge: 0xd0d6e0,
    checkpoint: 0x49d0a0,
    finish: 0xff5d73,
  },
  'magma-ridge': {
    skyTop: '#180512',
    skyBottom: '#c4452a',
    farColour: '#3a1c22',
    nearColour: '#241014',
    ridge: 'peaks',
    ground: 0x231216,
    surface: 0xff5a2a,
    ramp: 0x5c2a28,
    rampEdge: 0xff8a3a,
    checkpoint: 0xffc23e,
    finish: 0xffd06a,
  },
  'frost-peak': {
    skyTop: '#123a64',
    skyBottom: '#d8eefc',
    farColour: '#7fa4c4',
    nearColour: '#5f89ad',
    ridge: 'peaks',
    ground: 0xa8c4da,
    surface: 0xf4fbff,
    ramp: 0x9ab8d0,
    rampEdge: 0xffffff,
    checkpoint: 0x2ee59d,
    finish: 0xff5d73,
  },
  'orbit-circuit': {
    skyTop: '#06021a',
    skyBottom: '#5a2a86',
    farColour: '#2a1450',
    nearColour: '#18103a',
    ridge: 'domes',
    ground: 0x18103a,
    surface: 0xa06ad8,
    ramp: 0x2a1a5a,
    rampEdge: 0x35d6ff,
    checkpoint: 0x35d6ff,
    finish: 0xff5d73,
  },
};

export function themeFor(levelId: string): MapTheme {
  return THEMES[levelId] ?? DEFAULT_THEME;
}

const TILE_WIDTH = 512;
const TILE_HEIGHT = 256;

function canvas2d(width: number, height: number): CanvasRenderingContext2D | null {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element.getContext('2d');
}

/**
 * The skyline height at `x`, as a fraction of the tile height. Periodic over TILE_WIDTH by construction:
 * every frequency is a whole number of cycles across the tile.
 */
function skyline(x: number, style: RidgeStyle, seedPhase: number): number {
  const t = (x / TILE_WIDTH) * Math.PI * 2;
  const wave = (freq: number, amp: number, phase: number) => Math.sin(t * freq + phase) * amp;

  switch (style) {
    case 'waves':
      return 0.5 + wave(1, 0.18, seedPhase) + wave(2, 0.09, seedPhase * 2) + wave(5, 0.03, seedPhase);
    case 'peaks': {
      // A triangle wave: sharp summits rather than rounded swells.
      const base = Math.abs(((x / TILE_WIDTH) * 4 + seedPhase) % 2 - 1);
      return 0.62 - base * 0.42 + wave(3, 0.04, seedPhase);
    }
    case 'pines': {
      const spikes = Math.abs(((x / TILE_WIDTH) * 24 + seedPhase) % 2 - 1);
      return 0.55 - spikes * 0.16 + wave(2, 0.07, seedPhase);
    }
    case 'towers': {
      // Quantised into blocks, so the skyline reads as buildings and cranes rather than hills.
      const raw = 0.55 + wave(1, 0.12, seedPhase) + wave(3, 0.06, seedPhase * 1.7);
      return Math.round(raw * 8) / 8;
    }
    case 'domes':
      return 0.52 + wave(1, 0.14, seedPhase) + wave(4, 0.06, seedPhase * 3);
    case 'mesa':
    default: {
      const raw = 0.5 + wave(1, 0.12, seedPhase) + wave(2, 0.06, seedPhase * 2.3);
      return Math.round(raw * 12) / 12; // flat tops, eroded steps
    }
  }
}

/** One seamless ridge tile, transparent above the skyline. */
function ridgeTexture(style: RidgeStyle, colour: string, seedPhase: number): Texture | null {
  const context = canvas2d(TILE_WIDTH, TILE_HEIGHT);
  if (!context) return null;
  context.fillStyle = colour;
  context.beginPath();
  context.moveTo(0, TILE_HEIGHT);
  for (let x = 0; x <= TILE_WIDTH; x++) {
    context.lineTo(x, TILE_HEIGHT * (1 - skyline(x, style, seedPhase)));
  }
  context.lineTo(TILE_WIDTH, TILE_HEIGHT);
  context.closePath();
  context.fill();
  return Texture.from(context.canvas);
}

function skyTexture(top: string, bottom: string): Texture | null {
  const context = canvas2d(1, 256);
  if (!context) return null;
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 256);
  return Texture.from(context.canvas);
}

export interface Scenery {
  readonly container: Container;
  /** Called every frame: `cameraX` in pixels, plus the current screen size. */
  update(cameraX: number, width: number, height: number): void;
}

/**
 * Sky and two parallax ridges. Returns an empty container if a 2D canvas is unavailable — the game is still
 * perfectly playable against a plain background, so scenery must never be able to stop it from starting.
 */
export function createScenery(theme: MapTheme): Scenery {
  const container = new Container();
  const sky = skyTexture(theme.skyTop, theme.skyBottom);
  const far = ridgeTexture(theme.ridge, theme.farColour, 0.6);
  const near = ridgeTexture(theme.ridge, theme.nearColour, 2.4);

  const skySprite = sky ? new Sprite(sky) : null;
  if (skySprite) container.addChild(skySprite);

  const farSprite = far ? new TilingSprite({ texture: far, width: 1, height: 1 }) : null;
  const nearSprite = near ? new TilingSprite({ texture: near, width: 1, height: 1 }) : null;
  if (farSprite) container.addChild(farSprite);
  if (nearSprite) container.addChild(nearSprite);

  return {
    container,
    update(cameraX, width, height) {
      if (skySprite) {
        skySprite.width = width;
        skySprite.height = height;
      }
      // The further the layer, the less it moves. The near ridge also sits lower on screen.
      if (farSprite) {
        farSprite.width = width;
        farSprite.height = height * 0.42;
        farSprite.y = height * 0.26;
        farSprite.tilePosition.x = -cameraX * 0.12;
      }
      if (nearSprite) {
        nearSprite.width = width;
        nearSprite.height = height * 0.4;
        nearSprite.y = height * 0.42;
        nearSprite.tilePosition.x = -cameraX * 0.3;
      }
    },
  };
}
