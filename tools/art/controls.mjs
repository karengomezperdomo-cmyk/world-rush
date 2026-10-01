import { bikeSprite } from './bike.mjs';
import { Canvas, rotateSprite } from './lib/pixel.mjs';

/**
 * Icons for the four control pads, as pixel art rather than the stroke SVGs they started as.
 *
 * The SVG set was generic — two chevrons for gas, a filled square for brake, circular arrows for the leans —
 * and said nothing about a motorbike. These say what the control does: a fuel can, a brake disc, and for the
 * two lean pads THE BIKE ITSELF, tilted the way the pad tilts it. A picture of the outcome beats a symbol
 * the player has to learn, and it costs nothing to draw the thing that is already in the game.
 *
 * Authored at 24x24 (the leans come out larger, being the bike rotated) and rendered with
 * `image-rendering: pixelated`, so they stay crisp at whatever size the pad gives them.
 */

const C = {
  outline: '#150b1e',
  canRed: '#c8392b',
  canLight: '#e8604a',
  canDark: '#8a2018',
  cap: '#e8b043',
  capLight: '#ffd76a',
  steel: '#b9bdd0',
  steelLight: '#e4e8f5',
  steelDark: '#6b7089',
  rotorHole: '#2c2a3c',
  caliper: '#e8452b',
  caliperDark: '#a12a25',
};

const SIZE = 24;

/** Adds a dark outline around every opaque pixel, the same treatment the marshal gets. */
function outlined(src) {
  const out = new Canvas(src.w, src.h);
  out.blit(src, 0, 0);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (src.isOpaque(x, y)) continue;
      const touching =
        src.isOpaque(x - 1, y) ||
        src.isOpaque(x + 1, y) ||
        src.isOpaque(x, y - 1) ||
        src.isOpaque(x, y + 1);
      if (touching) out.set(x, y, C.outline);
    }
  }
  return out;
}

/** A jerry can: the throttle pad. */
export function fuelCan() {
  const c = new Canvas(SIZE, SIZE);

  // Handle across the top, with a gap under it so it reads as a handle and not a lid.
  c.rect(7, 3, 10, 2, C.canDark);
  c.rect(8, 5, 2, 2, C.canDark);
  c.rect(14, 5, 2, 2, C.canDark);
  c.hline(7, 3, 10, C.canLight);

  // Body
  c.rect(4, 6, 16, 15, C.canRed);
  c.vline(4, 6, 15, C.canLight);
  c.vline(5, 6, 15, C.canLight);
  c.vline(19, 6, 15, C.canDark);
  c.hline(4, 20, 16, C.canDark);
  c.hline(4, 6, 16, C.canLight);

  // The X brace stamped into the side of every fuel can.
  c.line(7, 9, 16, 18, C.canDark);
  c.line(16, 9, 7, 18, C.canDark);
  c.line(7, 10, 16, 19, C.canLight);

  // Spout and cap, off the top right.
  c.rect(17, 4, 4, 3, C.cap);
  c.hline(17, 4, 4, C.capLight);
  c.set(20, 6, C.canDark);

  // Feet
  c.rect(5, 21, 3, 1, C.canDark);
  c.rect(16, 21, 3, 1, C.canDark);

  return outlined(c);
}

/** A drilled brake disc with its caliper: the brake pad. */
export function brakeDisc() {
  const c = new Canvas(SIZE, SIZE);
  const cx = 11;
  const cy = 12;

  c.circle(cx, cy, 9, C.steel);
  c.circle(cx, cy, 8, C.steelLight);
  c.circle(cx, cy, 7, C.steel);
  c.circle(cx, cy, 4, C.steelDark);
  c.circle(cx, cy, 2, C.rotorHole);

  // Drill holes around the swept face — what makes a disc read as a disc.
  for (const [dx, dy] of [
    [0, -6],
    [4, -4],
    [6, 0],
    [4, 4],
    [0, 6],
    [-4, 4],
    [-6, 0],
    [-4, -4],
  ]) {
    c.set(cx + dx, cy + dy, C.rotorHole);
  }

  // Caliper gripping the top right of the disc.
  c.rect(14, 3, 7, 7, C.caliper);
  c.hline(14, 3, 7, '#ff7a4a');
  c.hline(14, 9, 7, C.caliperDark);
  c.vline(20, 3, 7, C.caliperDark);
  c.rect(16, 10, 3, 2, C.caliperDark);

  return outlined(c);
}

/**
 * The bike itself, tilted: nose up for LEAN BACK, nose down for LEAN FORWARD. The pad shows the pose it
 * produces, which beats any symbol the player would have to learn.
 *
 * A hand-drawn simplified version was tried first, on the theory that the rotated sprite looked rough. It
 * does look rough — at 6x zoom. At the ~38 px the pad actually gives it, the real bike reads instantly as a
 * motorbike pulling a wheelie while the simplified one reads as an abstract shape. The lesson is to judge
 * icons at the size they are used, not at the size that makes their flaws visible.
 */
export function leanIcon(direction) {
  const back = direction === 'back';
  const bike = bikeSprite({ lean: back ? -1 : 1, spin: 20 });
  // Screen y points DOWN, so a POSITIVE angle rotates clockwise and drops the nose. Lean back lifts it,
  // hence the negative. Checked by rendering both, not reasoned about once and trusted.
  return rotateSprite(bike, back ? -24 : 16);
}
