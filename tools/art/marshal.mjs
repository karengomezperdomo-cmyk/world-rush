import { Canvas } from './lib/pixel.mjs';

/**
 * The checkpoint marshal: a woman in a red dress who stands at every checkpoint and throws her arms up as
 * the rider passes.
 *
 * She replaces the plain vertical lines that used to mark checkpoints. A line tells you where a checkpoint
 * is; someone celebrating tells you that you have just taken it, which is the part the rider actually cares
 * about at speed.
 *
 * Drawn facing the viewer rather than in profile. At 22x34 art pixels (about 1.1 x 1.7 m at the game's 20
 * pixels per metre, so she stands a little shorter than the bike is long) a profile figure turns into an
 * unreadable smudge, while a front-facing one keeps a clear silhouette — and the raised arms have to read
 * instantly from the corner of the eye.
 *
 * Red against every one of the seven map palettes: it is the one hue none of the grounds or skies use, which
 * is why the dress is red rather than, say, the game's yellow.
 */

const C = {
  outline: '#150b1e',
  skin: '#f0b48a',
  skinShade: '#c98a63',
  hair: '#3a2418',
  hairLight: '#5c3a24',
  dress: '#e8452b',
  dressLight: '#ff7a4a',
  dressDark: '#a12a25',
  shoe: '#2a1c2e',
};

const W = 22;
const H = 34;

/** Head, hair, dress and legs: everything that does not change between poses. */
function drawBody(c) {
  // Legs
  c.rect(8, 26, 3, 6, C.skin);
  c.rect(12, 26, 3, 6, C.skin);
  c.vline(8, 26, 6, C.skinShade);
  c.vline(12, 26, 6, C.skinShade);
  c.rect(7, 32, 4, 2, C.shoe);
  c.rect(12, 32, 4, 2, C.shoe);

  // Dress: a trapezoid from the shoulders out to the hem, lit down its left edge.
  c.polygon(
    [
      [6, 13],
      [16, 13],
      [18, 26],
      [4, 26],
    ],
    C.dress,
  );
  c.line(6, 13, 4, 26, C.dressLight);
  c.line(16, 13, 18, 26, C.dressDark);
  c.hline(4, 26, 15, C.dressDark);
  // A waist seam, so the shape does not read as a plain triangle.
  c.hline(6, 19, 11, C.dressDark);
  c.hline(6, 20, 11, C.dressLight);

  // Neck and head
  c.rect(10, 11, 3, 2, C.skinShade);
  c.rect(7, 4, 8, 8, C.skin);
  c.vline(7, 4, 8, C.skinShade);
  c.hline(7, 11, 8, C.skinShade);

  // Hair: a cap over the crown with a fall down each side of the face.
  c.rect(6, 2, 10, 4, C.hair);
  c.hline(7, 2, 8, C.hairLight);
  c.rect(6, 5, 2, 7, C.hair);
  c.rect(14, 5, 2, 7, C.hair);
  c.set(6, 5, C.hairLight);

  // Eyes, which is all the face that survives at this size.
  c.set(9, 8, C.outline);
  c.set(12, 8, C.outline);
}

/**
 * @param {{ cheer?: boolean, frame?: number }} pose
 *   cheer: false = arms at her sides, true = both arms up.
 *   frame: alternates the raised arms so the cheer waves instead of freezing.
 */
export function marshal({ cheer = false, frame = 0 } = {}) {
  const c = new Canvas(W, H);
  drawBody(c);

  if (!cheer) {
    // Arms down, held slightly away from the dress so they stay visible against it.
    c.line(6, 14, 4, 22, C.skin, 2);
    c.line(16, 14, 18, 22, C.skin, 2);
    c.circle(4, 23, 1, C.skinShade);
    c.circle(18, 23, 1, C.skinShade);
  } else {
    // Arms up. The two frames differ by a couple of pixels at the hands, which at 20 px per metre is a
    // wave of about 10 cm — enough to read as movement, not so much that she looks like she is flailing.
    const lift = frame === 0 ? 0 : 2;
    c.line(6, 14, 2, 5 + lift, C.skin, 2);
    c.line(16, 14, 20, 5 + lift, C.skin, 2);
    c.circle(2, 4 + lift, 2, C.skin);
    c.circle(20, 4 + lift, 2, C.skin);
    c.set(2, 3 + lift, C.skinShade);
    c.set(20, 3 + lift, C.skinShade);
  }

  // Outline pass: any transparent pixel touching the figure becomes dark, which is what lifts her off
  // busy backgrounds like Emerald Woods' pines.
  const outlined = new Canvas(W, H);
  outlined.blit(c, 0, 0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (c.isOpaque(x, y)) continue;
      const touching =
        c.isOpaque(x - 1, y) || c.isOpaque(x + 1, y) || c.isOpaque(x, y - 1) || c.isOpaque(x, y + 1);
      if (touching) outlined.set(x, y, C.outline);
    }
  }
  return outlined;
}
