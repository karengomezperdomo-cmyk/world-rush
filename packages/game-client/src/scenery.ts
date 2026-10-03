import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';

/**
 * Backdrops and ground palettes, one per map.
 *
 * Every map used to render identically — a flat purple sky and a maroon slab — so the seven were only
 * distinguishable on the menu. The first pass at fixing that gave each one a sky and two flat silhouettes;
 * this is the second pass, which adds what made those read as cardboard cut-outs: a vertical gradient inside
 * each ridge, a lit rim along its skyline, strata, a third and nearest layer, and per-biome detail standing
 * on the horizon (pines, cranes, cacti, ice spires).
 *
 * Everything is generated into a canvas at load rather than shipped as image files. Two reasons: the ridges
 * must tile seamlessly across an 800 m track, which a hand-drawn strip does not do for free, and World's Mini
 * App guidelines put the initial load budget at 2-3 seconds, which is not where a set of full-width backdrops
 * per map belongs.
 *
 * Seamlessness is structural, not eyeballed: the skyline is a sum of sines whose frequencies are whole cycles
 * across the tile, so its right edge always meets its own left edge, and any decoration that crosses the edge
 * is drawn a second time a tile-width away. (`Math.sin` is fine here — the determinism lint that bans it
 * applies to `game-core`, where the simulation lives. Nothing in this file touches the simulation.)
 */

export type RidgeStyle = 'mesa' | 'waves' | 'pines' | 'towers' | 'peaks' | 'domes';
export type RidgeDecor = 'none' | 'pines' | 'cranes' | 'cacti' | 'spires' | 'palms' | 'rocks';
export type SkyBody = 'none' | 'sun' | 'moon' | 'stars';

export interface MapTheme {
  readonly skyTop: string;
  readonly skyBottom: string;
  /** Distant ridge: palest and slowest, so it reads as furthest away. */
  readonly farColour: string;
  readonly midColour: string;
  readonly nearColour: string;
  readonly ridge: RidgeStyle;
  readonly decor: RidgeDecor;
  readonly body: SkyBody;
  /** Drawn over the sky: haze near the horizon, which is what sells distance. */
  readonly haze: string;
  readonly ground: number;
  readonly surface: number;
  readonly ramp: number;
  readonly rampEdge: number;
  readonly checkpoint: number;
  readonly finish: number;
}

const DEFAULT_THEME: MapTheme = {
  skyTop: '#2b1b3d',
  skyBottom: '#ff9a4a',
  farColour: '#6b4258',
  midColour: '#4a2d44',
  nearColour: '#331e30',
  ridge: 'mesa',
  decor: 'cacti',
  body: 'sun',
  haze: '#ff8a4a',
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
    skyTop: '#0b3a72',
    skyBottom: '#9fe4f0',
    farColour: '#6fb4c0',
    midColour: '#3d8fa8',
    nearColour: '#1c6a80',
    ridge: 'waves',
    decor: 'palms',
    body: 'sun',
    haze: '#cdeff6',
    ground: 0xc9a96a,
    surface: 0xf2d9a0,
    ramp: 0xa8703a,
    rampEdge: 0xe0b878,
    checkpoint: 0x2ee59d,
    finish: 0xff5d73,
  },
  'emerald-woods': {
    skyTop: '#082722',
    skyBottom: '#9fdcbc',
    farColour: '#5f9c84',
    midColour: '#2f6b57',
    nearColour: '#17423a',
    ridge: 'pines',
    decor: 'pines',
    body: 'none',
    haze: '#cdeede',
    ground: 0x2d4a2a,
    surface: 0x5f8f4a,
    ramp: 0x6b4a2a,
    rampEdge: 0xa8834a,
    checkpoint: 0x8ae87a,
    finish: 0xff5d73,
  },
  'steel-yard': {
    skyTop: '#060a24',
    skyBottom: '#4d5f9c',
    farColour: '#41528a',
    midColour: '#2b3a63',
    nearColour: '#141b36',
    ridge: 'towers',
    decor: 'cranes',
    body: 'stars',
    haze: '#6a7cb8',
    ground: 0x2a2f42,
    surface: 0x7a8aff,
    ramp: 0x8a8f9a,
    rampEdge: 0xd0d6e0,
    checkpoint: 0x49d0a0,
    finish: 0xff5d73,
  },
  'magma-ridge': {
    skyTop: '#14040f',
    skyBottom: '#d4512a',
    farColour: '#6b2f2c',
    midColour: '#45201f',
    nearColour: '#1f0e12',
    ridge: 'peaks',
    decor: 'rocks',
    body: 'none',
    haze: '#ff7a3a',
    ground: 0x231216,
    surface: 0xff5a2a,
    ramp: 0x5c2a28,
    rampEdge: 0xff8a3a,
    checkpoint: 0xffc23e,
    finish: 0xffd06a,
  },
  'frost-peak': {
    skyTop: '#0f3a64',
    skyBottom: '#e6f4ff',
    farColour: '#b4cfe4',
    midColour: '#87aac8',
    nearColour: '#5a7f9f',
    ridge: 'peaks',
    decor: 'spires',
    body: 'sun',
    haze: '#eaf6ff',
    ground: 0xa8c4da,
    surface: 0xf4fbff,
    ramp: 0x9ab8d0,
    rampEdge: 0xffffff,
    checkpoint: 0x2ee59d,
    finish: 0xff5d73,
  },
  'orbit-circuit': {
    skyTop: '#04010f',
    skyBottom: '#6b32a0',
    farColour: '#4a2a80',
    midColour: '#2d1858',
    nearColour: '#150c30',
    ridge: 'domes',
    decor: 'rocks',
    body: 'moon',
    haze: '#8a4ad0',
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

/** Small deterministic PRNG, so a map looks identical every time it loads. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
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
      return (
        0.5 + wave(1, 0.18, seedPhase) + wave(2, 0.09, seedPhase * 2) + wave(5, 0.03, seedPhase)
      );
    case 'peaks': {
      const base = Math.abs((((x / TILE_WIDTH) * 4 + seedPhase) % 2) - 1);
      return 0.68 - base * 0.46 + wave(3, 0.04, seedPhase);
    }
    case 'pines': {
      const spikes = Math.abs((((x / TILE_WIDTH) * 24 + seedPhase) % 2) - 1);
      return 0.55 - spikes * 0.16 + wave(2, 0.07, seedPhase);
    }
    case 'towers': {
      const raw = 0.55 + wave(1, 0.12, seedPhase) + wave(3, 0.06, seedPhase * 1.7);
      return Math.round(raw * 8) / 8;
    }
    case 'domes':
      return 0.52 + wave(1, 0.14, seedPhase) + wave(4, 0.06, seedPhase * 3);
    case 'mesa':
    default: {
      const raw = 0.5 + wave(1, 0.14, seedPhase) + wave(2, 0.07, seedPhase * 2.3);
      return Math.round(raw * 12) / 12;
    }
  }
}

function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(((value >> 16) & 255) * amount);
  const g = clamp(((value >> 8) & 255) * amount);
  const b = clamp((value & 255) * amount);
  return `rgb(${r},${g},${b})`;
}

/** Decorations standing on the skyline. Anything crossing the tile edge is drawn again a width away. */
function drawDecor(
  context: CanvasRenderingContext2D,
  decor: RidgeDecor,
  colour: string,
  heightAt: (x: number) => number,
  seed: number,
  scale: number,
): void {
  if (decor === 'none') return;
  const random = rng(seed);
  const count = decor === 'pines' ? 26 : decor === 'rocks' ? 18 : 9;

  for (let i = 0; i < count; i++) {
    const x = random() * TILE_WIDTH;
    const baseY = heightAt(x) + 2;
    const size = (12 + random() * 22) * scale;
    for (const offset of [0, -TILE_WIDTH, TILE_WIDTH]) {
      const px = x + offset;
      if (px < -60 || px > TILE_WIDTH + 60) continue;
      context.fillStyle = colour;
      context.beginPath();
      switch (decor) {
        case 'pines':
        case 'spires':
          context.moveTo(px, baseY - size);
          context.lineTo(px + size * 0.34, baseY);
          context.lineTo(px - size * 0.34, baseY);
          break;
        case 'cacti':
          context.rect(px - size * 0.09, baseY - size, size * 0.18, size);
          context.rect(px - size * 0.32, baseY - size * 0.62, size * 0.23, size * 0.12);
          context.rect(px - size * 0.32, baseY - size * 0.62, size * 0.1, size * 0.34);
          context.rect(px + size * 0.12, baseY - size * 0.78, size * 0.22, size * 0.11);
          context.rect(px + size * 0.26, baseY - size * 0.78, size * 0.1, size * 0.42);
          break;
        case 'cranes':
          context.rect(px - size * 0.05, baseY - size, size * 0.1, size);
          context.rect(px - size * 0.5, baseY - size, size * 1.05, size * 0.07);
          context.rect(px - size * 0.4, baseY - size * 0.93, size * 0.05, size * 0.3);
          break;
        case 'palms':
          context.rect(px - size * 0.05, baseY - size, size * 0.1, size);
          for (const dx of [-0.42, -0.22, 0.22, 0.42]) {
            context.rect(px + size * dx * 0.5, baseY - size, size * 0.24, size * 0.07);
          }
          break;
        case 'rocks':
          context.moveTo(px - size * 0.4, baseY);
          context.lineTo(px - size * 0.12, baseY - size * 0.55);
          context.lineTo(px + size * 0.2, baseY - size * 0.35);
          context.lineTo(px + size * 0.45, baseY);
          break;
      }
      context.closePath();
      context.fill();
    }
  }
}

/**
 * One seamless ridge tile: a gradient body, a lit rim along the skyline, strata, and decorations on top.
 * Transparent above the skyline so the layer behind shows through.
 */
function ridgeTexture(
  style: RidgeStyle,
  decor: RidgeDecor,
  colour: string,
  seedPhase: number,
  seed: number,
  decorScale: number,
): Texture | null {
  const context = canvas2d(TILE_WIDTH, TILE_HEIGHT);
  if (!context) return null;
  const heightAt = (x: number) => TILE_HEIGHT * (1 - skyline(x, style, seedPhase));

  // Body, as a vertical gradient: lighter at the skyline, sinking into shadow at the base.
  const gradient = context.createLinearGradient(0, 0, 0, TILE_HEIGHT);
  gradient.addColorStop(0, shade(colour, 1.12));
  gradient.addColorStop(1, shade(colour, 0.55));
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(0, TILE_HEIGHT);
  for (let x = 0; x <= TILE_WIDTH; x++) context.lineTo(x, heightAt(x));
  context.lineTo(TILE_WIDTH, TILE_HEIGHT);
  context.closePath();
  context.fill();

  // Strata: faint horizontal banding, clipped to the ridge so it never bleeds into the sky.
  context.save();
  context.clip();
  context.fillStyle = 'rgba(0,0,0,0.13)';
  for (let y = 0; y < TILE_HEIGHT; y += 11) context.fillRect(0, y, TILE_WIDTH, 3);
  context.restore();

  // The lit rim: one bright line along the skyline, which is what makes a silhouette read as lit terrain.
  context.strokeStyle = shade(colour, 1.45);
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 0; x <= TILE_WIDTH; x++) {
    const y = heightAt(x);
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  drawDecor(context, decor, shade(colour, 0.78), heightAt, seed, decorScale);
  return Texture.from(context.canvas);
}

/**
 * The sky gradient, as a ONE PIXEL WIDE strip.
 *
 * It gets stretched to the whole screen, and a gradient that only varies vertically cannot be distorted by
 * that. The first version baked the sun into a 256x256 sky and stretched the lot, which turned the sun into
 * an ellipse on every screen whose aspect ratio was not square — which is all of them.
 */
function skyGradientTexture(theme: MapTheme): Texture | null {
  const context = canvas2d(1, 256);
  if (!context) return null;
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, theme.skyTop);
  gradient.addColorStop(1, theme.skyBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 256);

  // Horizon haze: the cheapest thing that makes distance believable.
  const haze = context.createLinearGradient(0, 150, 0, 256);
  haze.addColorStop(0, 'rgba(0,0,0,0)');
  haze.addColorStop(1, theme.haze);
  context.globalAlpha = 0.45;
  context.fillStyle = haze;
  context.fillRect(0, 150, 1, 106);
  return Texture.from(context.canvas);
}

/** Stars, on a tile that repeats horizontally — so they stay square whatever the screen's shape. */
function starsTexture(): Texture | null {
  const context = canvas2d(TILE_WIDTH, TILE_HEIGHT);
  if (!context) return null;
  const random = rng(97);
  for (let i = 0; i < 150; i++) {
    const alpha = 0.25 + random() * 0.75;
    context.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    const size = random() < 0.15 ? 3 : 2;
    context.fillRect(
      Math.floor(random() * TILE_WIDTH),
      Math.floor(random() * TILE_HEIGHT),
      size,
      size,
    );
  }
  return Texture.from(context.canvas);
}

/** The sun or moon, drawn square and scaled uniformly so it stays a circle. */
function bodyTexture(body: SkyBody): Texture | null {
  if (body !== 'sun' && body !== 'moon') return null;
  const size = 160;
  const context = canvas2d(size, size);
  if (!context) return null;
  const centre = size / 2;
  const glow = context.createRadialGradient(centre, centre, 2, centre, centre, centre);
  glow.addColorStop(0, body === 'sun' ? 'rgba(255,240,190,0.95)' : 'rgba(210,220,255,0.7)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
  context.fillStyle = body === 'sun' ? '#fff6cc' : '#e8ecff';
  context.beginPath();
  context.arc(centre, centre, size * 0.16, 0, Math.PI * 2);
  context.fill();
  if (body === 'moon') {
    // A bite out of one side, so it reads as a moon rather than a second sun.
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(centre + size * 0.1, centre - size * 0.07, size * 0.14, 0, Math.PI * 2);
    context.fill();
  }
  return Texture.from(context.canvas);
}

export interface Scenery {
  readonly container: Container;
  update(cameraX: number, width: number, height: number): void;
}

/**
 * Sky and three parallax ridges. Returns an empty container if a 2D canvas is unavailable — the game is
 * perfectly playable against a plain background, so scenery must never stop it from starting.
 */
export function createScenery(theme: MapTheme): Scenery {
  const container = new Container();

  const gradient = skyGradientTexture(theme);
  const skySprite = gradient ? new Sprite(gradient) : null;
  if (skySprite) container.addChild(skySprite);

  const stars = theme.body === 'stars' ? starsTexture() : null;
  const starSprite = stars ? new TilingSprite({ texture: stars, width: 1, height: 1 }) : null;
  if (starSprite) container.addChild(starSprite);

  const body = bodyTexture(theme.body);
  const bodySprite = body ? new Sprite(body) : null;
  if (bodySprite) {
    bodySprite.anchor.set(0.5);
    container.addChild(bodySprite);
  }

  // Nearer layers are darker, bigger-featured and faster: three cues for the same depth.
  const layers = [
    {
      texture: ridgeTexture(theme.ridge, theme.decor, theme.farColour, 0.6, 11, 0.6),
      speed: 0.08,
      height: 0.34,
      top: 0.24,
    },
    {
      texture: ridgeTexture(theme.ridge, theme.decor, theme.midColour, 2.4, 29, 0.85),
      speed: 0.18,
      height: 0.34,
      top: 0.38,
    },
    {
      texture: ridgeTexture(theme.ridge, theme.decor, theme.nearColour, 4.1, 53, 1.15),
      speed: 0.34,
      height: 0.32,
      top: 0.5,
    },
  ].flatMap((layer) =>
    layer.texture
      ? [{ sprite: new TilingSprite({ texture: layer.texture, width: 1, height: 1 }), ...layer }]
      : [],
  );
  for (const layer of layers) container.addChild(layer.sprite);

  return {
    container,
    update(cameraX, width, height) {
      if (skySprite) {
        skySprite.width = width;
        skySprite.height = height;
      }
      if (starSprite) {
        starSprite.width = width;
        starSprite.height = height * 0.6;
        // Stars drift very slightly, which is what keeps them from looking painted onto the screen.
        starSprite.tilePosition.x = -cameraX * 0.02;
      }
      if (bodySprite) {
        // Square scale, so it is always a circle; barely moves, because it is supposed to be far away.
        const size = Math.min(width, height) * 0.62;
        bodySprite.width = size;
        bodySprite.height = size;
        bodySprite.position.set(width * 0.72 - cameraX * 0.015, height * 0.26);
      }
      for (const layer of layers) {
        layer.sprite.width = width;
        layer.sprite.height = height * layer.height;
        layer.sprite.y = height * layer.top;
        layer.sprite.tilePosition.x = -cameraX * layer.speed;
      }
    },
  };
}
