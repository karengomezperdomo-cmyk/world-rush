import { Canvas } from './lib/pixel.mjs';

/**
 * The checkpoint marshal: a woman in a red gown who waits at every checkpoint and throws her arms up as the
 * rider passes.
 *
 * She replaces the plain vertical lines that used to mark checkpoints. A line tells you where a checkpoint
 * is; someone celebrating tells you that you have just taken one, which is the part the rider cares about.
 *
 * Built from the owner's second reference sheet, which is much more specific than the first: enormous
 * volume of wavy brown hair falling past the hips, a strapless gown with bare shoulders, a sharply drawn
 * hourglass, a high slit baring one whole leg, gold chains at the waist and throat, and strapped red heels.
 *
 * ## Size
 *
 * 36x46 art pixels. At the game's 20 pixels per metre that is 2.3 m, which is not a human height — it is a
 * licence the owner approved, because at a correct 1.7 m none of this detail survives. The width matters as
 * much as the height here: the hair is the loudest thing in the reference and it needs room to spill past
 * the shoulders rather than being clipped to the body.
 *
 * ## The silhouette is a table, not a shape
 *
 * The whole impression comes from the outline, so the body is a list of half-widths at key rows, interpolated
 * between. The hourglass is therefore explicit and tunable — bust 7.6, waist 3.6, hips 7.6 — rather than
 * eyeballed. The very first version drew a plain trapezoid and read as a traffic cone.
 */

const C = {
  outline: '#1a0a12',
  skin: '#f7cba4',
  skinMid: '#e2ab80',
  skinShade: '#c08258',
  hair: '#3a1f14',
  hairMid: '#5e3620',
  hairLight: '#8b5830',
  hairShine: '#b8814a',
  dress: '#c81f33',
  dressLight: '#ec4a5c',
  dressGlow: '#ff7382',
  dressDark: '#86101f',
  dressDeep: '#560a15',
  gold: '#e8b043',
  goldLight: '#ffd76a',
  lips: '#d8364a',
  eyeWhite: '#fdf2ef',
  eye: '#2a1018',
  blush: '#ef9a94',
};

const W = 36;
const H = 46;
const MID = 18;

/** Half-width of the body at key rows; everything between is interpolated. */
const SILHOUETTE = [
  [13, 4.2], // bare shoulders
  [16, 6.4],
  [19, 7.6], // bust
  [22, 5.4],
  [25, 3.6], // waist — the pinch has to be deep, or at this size it simply is not there
  [26, 3.7],
  [29, 7.6], // hips, as wide as the bust
  [32, 9.0],
  [36, 11.0],
  [40, 13.0],
  [44, 15.0],
  [45, 15.5], // hem
];

function halfWidthAt(y) {
  if (y <= SILHOUETTE[0][0]) return SILHOUETTE[0][1];
  const last = SILHOUETTE[SILHOUETTE.length - 1];
  if (y >= last[0]) return last[1];
  for (let i = 0; i < SILHOUETTE.length - 1; i++) {
    const [y0, h0] = SILHOUETTE[i];
    const [y1, h1] = SILHOUETTE[i + 1];
    if (y >= y0 && y <= y1) return h0 + (h1 - h0) * ((y - y0) / (y1 - y0));
  }
  return last[1];
}

/** Rows where one ruffle tier ends and the next begins. */
const RUFFLE_ROWS = [34, 39, 44];

/**
 * The hair, drawn BEFORE the body so it falls behind her.
 *
 * In the reference the hair is the loudest thing on the sheet: it is wider than her shoulders, falls past
 * the hips and keeps its volume the whole way down. So it is drawn as a MASS with its own outline rather
 * than as a couple of strands beside the head — two thin bars at a fixed x read as a chair back, not hair.
 */
function drawHairBack(c) {
  for (let y = 4; y <= 38; y++) {
    // Volume is DELIBERATELY smallest at the shoulders and widest over the hips. A mass that peaked at the
    // shoulders swallowed them whole: she lost her neck, her arms disappeared into it, and the hourglass the
    // silhouette table works so hard for was hidden behind hair. In the reference the hair is huge but it
    // falls BEHIND and spreads as it descends, so the bare shoulders stay the brightest line on her.
    const volume =
      y < 13
        ? 6.2 + (y - 4) * 0.12
        : y < 24
          ? 7.3 + (y - 13) * 0.33
          : Math.max(4.5, 11 - (y - 24) * 0.45);
    const sway = Math.sin((y - 4) * 0.28) * 1.4;
    const left = Math.round(MID - volume + sway * 0.4);
    const right = Math.round(MID + volume + sway * 0.4);
    for (let x = left; x <= right; x++) {
      const across = (x - left) / Math.max(1, right - left);
      let colour = C.hair;
      if (across < 0.13) colour = C.hairMid;
      else if (across < 0.24) colour = C.hairLight;
      else if (across > 0.88) colour = C.hairMid;
      c.set(x, y, colour);
    }
    // Strand lines, so the mass reads as hair rather than as a brown shape.
    if (y % 3 === 0) {
      c.set(left + 4, y, C.hairMid);
      c.set(right - 4, y, C.hairMid);
    }
    if ((y + 2) % 7 === 0) {
      c.set(left + 2, y, C.hairShine);
      c.set(right - 2, y, C.hairLight);
    }
  }
  // Tips: a few loose curls rather than a flat cut.
  for (const [x, y] of [
    [MID - 5, 39],
    [MID - 4, 40],
    [MID + 5, 39],
    [MID + 6, 40],
    [MID + 5, 41],
  ]) {
    c.set(x, y, C.hair);
  }
}

/** Bare shoulders, chest and the arms' upper reach — drawn under the gown so the neckline cuts into it. */
function drawUpperBody(c) {
  for (let y = 12; y <= 20; y++) {
    const half = halfWidthAt(y) - 0.4;
    const left = Math.round(MID - half);
    const right = Math.round(MID + half);
    for (let x = left; x <= right; x++) c.set(x, y, C.skin);
    c.set(left, y, C.skinMid);
    c.set(right, y, C.skinShade);
  }
  // Collarbones and the shadow between — what tells you the gown is strapless.
  c.hline(MID - 4, 14, 3, C.skinMid);
  c.hline(MID + 2, 14, 3, C.skinMid);
  c.set(MID, 17, C.skinMid);
  c.set(MID, 18, C.skinShade);
}

/** The gown: strapless sweetheart bodice, tiered ruffles, gold chains, and a slit baring one leg. */
function drawGown(c) {
  for (let y = 18; y <= 45; y++) {
    const half = halfWidthAt(y);
    const left = Math.round(MID - half);
    const right = Math.round(MID + half);
    const tier = RUFFLE_ROWS.filter((row) => y > row).length;
    for (let x = left; x <= right; x++) {
      const across = (x - left) / Math.max(1, right - left);
      let colour = C.dress;
      if (across < 0.18) colour = C.dressLight;
      else if (across > 0.8) colour = C.dressDark;
      if (tier > 1 && colour === C.dress) colour = C.dressDark;
      c.set(x, y, colour);
    }
    // The lip of each ruffle, SCALLOPED rather than ruled straight across. A flat highlighted row made the
    // skirt read as a tiered cake; fabric hangs in a wavy edge, so the lit line rises and falls across it.
    if (RUFFLE_ROWS.includes(y)) {
      for (let x = left; x <= right; x++) {
        const scallop = Math.round(Math.sin((x - left) * 0.8) * 1.3);
        c.set(x, y + scallop, C.dressGlow);
        c.set(x, y + scallop + 1, C.dressDeep);
      }
    }
    if (y >= 31 && !RUFFLE_ROWS.includes(y)) {
      c.set(MID - Math.round(half * 0.6), y, C.dressDark);
      c.set(MID + Math.round(half * 0.32), y, C.dressDeep);
    }
  }

  // Sweetheart neckline: two curves dipping to a point at the centre, cut out of the bodice so the chest
  // above it stays bare. This is the line that makes the gown strapless rather than a tube.
  for (let x = MID - 6; x <= MID + 6; x++) {
    const dip = Math.round(Math.cos((x - MID) * 0.52) * 2.2);
    for (let y = 18; y < 18 + dip; y++) c.set(x, y, C.skin);
    c.set(x, 18 + dip, C.dressGlow);
  }
  c.set(MID, 18, C.skinMid);
  c.set(MID, 19, C.skinMid);

  // Under-bust shadow: the few rows that turn a flat red panel into a figure.
  for (let x = MID - 5; x <= MID + 5; x++) c.set(x, 23, C.dressDark);
  c.hline(MID - 4, 22, 3, C.dressGlow);
  c.hline(MID + 2, 22, 3, C.dressGlow);

  // The slit: her left leg, bare from the hip all the way down, as in the reference.
  for (let y = 27; y <= 45; y++) {
    const lean = Math.round((y - 27) * 0.26);
    const legLeft = MID + 2 + lean;
    const width = y < 34 ? 4 : 3;
    for (let x = legLeft; x <= legLeft + width; x++) c.set(x, y, C.skin);
    c.set(legLeft, y, C.skinMid);
    c.set(legLeft + width, y, C.skinShade);
  }

  // Gold: a chain slung across the hips, a drop down the skirt, and a choker at the throat.
  for (let x = MID - 6; x <= MID + 6; x++) c.set(x, 26, C.gold);
  c.set(MID - 4, 26, C.goldLight);
  c.set(MID + 4, 26, C.goldLight);
  for (let y = 27; y <= 31; y++) c.set(MID - 1, y, y % 2 === 0 ? C.gold : C.goldLight);
  c.hline(MID - 3, 12, 7, C.gold);
  c.set(MID, 13, C.goldLight);
}

function drawHead(c) {
  // Face
  c.rect(14, 4, 8, 9, C.skin);
  c.vline(21, 4, 9, C.skinMid);
  c.hline(14, 12, 8, C.skinMid);
  c.set(14, 4, C.skinMid);
  c.set(21, 4, C.skinMid);

  // Brows, eyes with a highlight, lashes — the whole expression lives in a handful of pixels.
  c.hline(15, 6, 2, C.hair);
  c.hline(19, 6, 2, C.hair);
  c.rect(15, 8, 2, 2, C.eyeWhite);
  c.rect(19, 8, 2, 2, C.eyeWhite);
  c.set(15, 8, C.eye);
  c.set(19, 8, C.eye);
  c.set(16, 9, C.eye);
  c.set(20, 9, C.eye);
  c.set(15, 7, C.hair);
  c.set(20, 7, C.hair);
  c.set(14, 10, C.blush);
  c.set(21, 10, C.blush);
  c.set(17, 11, C.lips);
  c.set(18, 11, C.lips);

  // Gold drop earrings, straight from the reference.
  c.set(13, 9, C.gold);
  c.set(13, 10, C.goldLight);
  c.set(22, 9, C.gold);
  c.set(22, 10, C.goldLight);

  // The fringe and the front sweep of hair framing the face.
  c.rect(13, 0, 10, 4, C.hair);
  c.hline(14, 0, 8, C.hairMid);
  c.set(16, 1, C.hairShine);
  c.set(19, 0, C.hairLight);
  c.rect(12, 2, 2, 10, C.hair);
  c.rect(22, 2, 2, 10, C.hair);
  c.set(12, 4, C.hairMid);
  c.set(23, 6, C.hairMid);

  // Red bow, worn high on her right: two loops and a trailing ribbon.
  c.rect(6, 1, 5, 4, C.dress);
  c.rect(6, 5, 4, 3, C.dressDark);
  c.set(6, 1, C.dressLight);
  c.set(7, 2, C.dressGlow);
  c.rect(11, 3, 2, 3, C.dressDark);
  c.rect(5, 5, 1, 6, C.dress);
  c.rect(8, 8, 1, 5, C.dressDark);
  c.set(5, 10, C.dressDark);
}

/** Strapped heels, as in the reference. */
function drawHeels(c) {
  for (const x of [MID - 6, MID + 3]) {
    c.rect(x, 44, 4, 1, C.dress);
    c.set(x, 45, C.dressDark);
    c.set(x + 3, 45, C.dressDark);
    c.set(x + 1, 43, C.dressLight); // ankle strap
  }
}

/**
 * @param {{ cheer?: boolean, frame?: number }} pose
 *   cheer: false = arms down, true = both arms up.
 *   frame: alternates the raised arms so the cheer waves instead of freezing.
 */
export function marshal({ cheer = false, frame = 0 } = {}) {
  const c = new Canvas(W, H);
  drawHairBack(c);
  drawUpperBody(c);
  drawGown(c);
  drawHeels(c);
  drawHead(c);

  if (!cheer) {
    // Arms down and slightly out, following the waist in rather than hanging straight.
    c.line(12, 16, 8, 28, C.skin, 2);
    c.line(24, 16, 28, 28, C.skin, 2);
    c.set(8, 29, C.skinShade);
    c.set(28, 29, C.skinShade);
    // Armlets high on each arm, plus a bracelet at each wrist.
    c.set(11, 19, C.goldLight);
    c.set(25, 19, C.goldLight);
    c.set(8, 27, C.gold);
    c.set(28, 27, C.gold);
  } else {
    // Arms up. The frames differ by two pixels at the hands — about 10 cm at this scale, which reads as a
    // wave rather than as flailing.
    const lift = frame === 0 ? 0 : 2;
    c.line(12, 16, 5, 3 + lift, C.skin, 2);
    c.line(24, 16, 31, 3 + lift, C.skin, 2);
    c.circle(5, 2 + lift, 2, C.skin);
    c.circle(31, 2 + lift, 2, C.skin);
    c.set(5, 1 + lift, C.skinMid);
    c.set(31, 1 + lift, C.skinMid);
    c.set(7, 6 + lift, C.gold);
    c.set(29, 6 + lift, C.gold);
    c.set(10, 11 + lift, C.goldLight);
    c.set(26, 11 + lift, C.goldLight);
  }

  // Outline pass: any transparent pixel touching the figure goes dark, which is what lifts her off busy
  // backgrounds like Emerald Woods' pines.
  const outlined = new Canvas(W, H);
  outlined.blit(c, 0, 0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (c.isOpaque(x, y)) continue;
      const touching =
        c.isOpaque(x - 1, y) ||
        c.isOpaque(x + 1, y) ||
        c.isOpaque(x, y - 1) ||
        c.isOpaque(x, y + 1);
      if (touching) outlined.set(x, y, C.outline);
    }
  }
  return outlined;
}
