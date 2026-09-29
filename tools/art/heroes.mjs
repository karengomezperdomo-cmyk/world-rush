import { mesaLayer } from './canyon.mjs';
import { Canvas, mix, rng } from './lib/pixel.mjs';

/**
 * Hero scenes for maps 2-7, at the same 175x183 as Sunset Canyon's in `canyon.mjs`.
 *
 * Until now only map 1 had one, and the Home screen fell back to blowing a 46x28 thumbnail up behind the
 * day's name — at a 4x upscale in a corner, because stretching it across the whole panel turned it to mush.
 * These are drawn at hero size instead.
 *
 * The composition of every scene is dictated by what sits on top of it: the copy block is pinned top-left,
 * the countdown top-right, and the PLAY NOW buttons overlay the bottom. So each scene keeps its detail in
 * the middle and lower-right, puts nothing important in the top-left, and stays dark enough on the left for
 * white text to read against it — `ui.css` also lays a left-to-right scrim over the art.
 *
 * `sky()` in canyon.mjs is hard-wired to that map's sunset palette, so these use their own.
 */

const W = 175;
const H = 183;

/** Sky gradient plus optional stars and cloud bands. The one piece every scene starts from. */
function skyOf(stops, { horizon, seed = 7, stars = 0, starColours = ['#ffffff'], clouds } = {}) {
  const c = new Canvas(W, H);
  c.gradient(0, 0, W, horizon, stops);
  const r = rng(seed);
  for (let i = 0; i < stars; i++) {
    c.set(r.int(0, W - 1), r.int(0, Math.floor(horizon * 0.72)), r.pick(starColours));
  }
  if (clouds) {
    const cr = rng(seed + 4);
    for (let i = 0; i < clouds.count; i++) {
      const len = cr.int(22, 54);
      const x = cr.int(-10, W - 12);
      const y = cr.int(Math.floor(horizon * 0.18), Math.floor(horizon * 0.66));
      c.hline(x + 3, y, len - 6, clouds.high);
      c.hline(x, y + 1, len, clouds.mid);
      c.hline(x + 2, y + 2, len - 4, clouds.low);
    }
  }
  return c;
}

/**
 * A soft radial glow, for suns, lava and neon.
 *
 * Blending is left to `Canvas.set`, which already composites alpha correctly — the falloff is expressed as
 * the colour's alpha channel rather than by reading the pixel underneath (`Canvas.get` returns an RGBA
 * array, not a colour string, so mixing with it here would need converting back and forth for no gain).
 * `colour` must be a 6-digit hex.
 */
function glow(c, cx, cy, radius, colour, strength) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius) continue;
      const falloff = (1 - distance / radius) ** 1.6 * strength;
      const alpha = Math.round(Math.max(0, Math.min(1, falloff)) * 255);
      if (alpha > 2) c.set(x, y, colour + alpha.toString(16).padStart(2, '0'));
    }
  }
}

/** Rolling foreground ground with a lit top edge. Returns the surface height at each column. */
function groundBand(c, { top, amplitude, seed, body, rim, bottomShade }) {
  const r = rng(seed);
  const surface = new Array(W);
  let y = top;
  for (let x = 0; x < W; x++) {
    if (x % 6 === 0) y += r.int(-amplitude, amplitude);
    y = Math.max(top - amplitude * 3, Math.min(top + amplitude * 3, y));
    surface[x] = y;
    for (let py = y; py < H; py++) {
      const depth = (py - y) / Math.max(1, H - y);
      c.set(x, py, mix(body, bottomShade, depth * 0.8));
    }
    c.set(x, y, rim);
  }
  return surface;
}

function palm(c, x, baseY, height) {
  let topX = x;
  for (let i = 0; i < height; i++) {
    const bend = Math.round(Math.sin((i / height) * 1.7) * 7);
    c.set(x + bend, baseY - i, '#6a3f24');
    c.set(x + 1 + bend, baseY - i, '#a86a3a');
    c.set(x + 2 + bend, baseY - i, '#5a3520');
    topX = x + bend;
  }
  const topY = baseY - height;
  for (const [dx, dy] of [
    [-17, 3],
    [-13, -7],
    [-4, -12],
    [8, -10],
    [16, -1],
    [13, 7],
    [-9, 10],
  ]) {
    c.line(topX, topY, topX + dx, topY + dy, '#1f8a4a', 2);
    c.line(topX, topY, Math.round(topX + dx * 0.6), Math.round(topY + dy * 0.6), '#5ad07a');
    c.set(topX + dx, topY + dy + 1, '#7ae89a');
  }
  c.circle(topX + 1, topY + 2, 2, '#6a4020');
}

function pine(c, cx, baseY, height, body, lit, snow = false) {
  const tiers = Math.max(3, Math.round(height / 9));
  for (let i = 0; i < tiers; i++) {
    const top = baseY - height + Math.round((i * height) / tiers);
    const tierH = Math.round(height / tiers) + 5;
    const half = 3 + Math.round(((i + 1) * (height / 2.6)) / tiers);
    c.polygon(
      [
        [cx, top],
        [cx + half, top + tierH],
        [cx - half, top + tierH],
      ],
      body,
    );
    c.line(cx, top, cx - half, top + tierH, lit);
    if (snow) {
      c.hline(cx - Math.max(1, half - 3), top + tierH - 1, Math.max(2, half * 2 - 5), '#f4fbff');
      c.hline(cx - Math.max(1, half - 5), top + tierH - 2, Math.max(2, half * 2 - 9), '#e2f0ff');
    }
  }
  c.rect(cx - 1, baseY - 4, 2, 4, '#3a2418');
}

/** Map 2 — Coral Coast. Reef on the horizon, shallow water, sand in the foreground. */
export function heroCoralCoast() {
  const horizon = 96;
  const c = skyOf(
    [
      [0, '#0d3b6e'],
      [0.45, '#2a8fd0'],
      [0.8, '#7fd0ec'],
      [1, '#dff6f2'],
    ],
    { horizon, seed: 12, clouds: { count: 5, high: '#ffffff55', mid: '#ffffff99', low: '#bfe8ff88' } },
  );

  // A low reef island, sitting right on the waterline.
  c.polygon(
    [
      [96, horizon],
      [112, horizon - 16],
      [132, horizon - 20],
      [152, horizon - 11],
      [175, horizon],
    ],
    '#2f6f80',
  );
  c.line(112, horizon - 16, 132, horizon - 20, '#54a0a8');
  palm(c, 128, horizon - 18, 16);

  // Sea: darker out, brighter in, with broken white water.
  c.gradient(0, horizon, W, 46, [
    [0, '#12719c'],
    [0.6, '#1b9ac9'],
    [1, '#63d6e4'],
  ]);
  const r = rng(21);
  for (let i = 0; i < 90; i++) {
    const y = r.int(horizon + 2, horizon + 42);
    const x = r.int(0, W - 8);
    c.hline(x, y, r.int(2, 7), y > horizon + 28 ? '#ffffff' : '#bff0ff');
  }

  // Wet sand, then dry sand.
  c.polygon(
    [
      [0, horizon + 44],
      [58, horizon + 40],
      [120, horizon + 48],
      [175, horizon + 44],
      [175, H],
      [0, H],
    ],
    '#e8cf95',
  );
  c.line(0, horizon + 44, 58, horizon + 40, '#fff3cd');
  c.line(58, horizon + 40, 120, horizon + 48, '#fff3cd');
  const sr = rng(33);
  for (let i = 0; i < 140; i++) {
    const x = sr.int(0, W - 1);
    const y = sr.int(horizon + 50, H - 1);
    c.set(x, y, sr() < 0.5 ? '#d9b878' : '#f4e0ad');
  }
  palm(c, 24, H - 12, 34);
  palm(c, 150, H - 4, 26);
  return c;
}

/** Map 3 — Emerald Woods. Three depths of pines in mist, dark forest floor. */
export function heroEmeraldWoods() {
  const horizon = 112;
  const c = skyOf(
    [
      [0, '#0b2a26'],
      [0.5, '#1d5a4a'],
      [1, '#8fd6b0'],
    ],
    { horizon, seed: 9, clouds: { count: 4, high: '#ffffff33', mid: '#dff5e866', low: '#9fd8bc55' } },
  );

  // Far ridge, hazed out so the near trees read as closer.
  c.blit(
    mesaLayer({
      w: W,
      h: H,
      base: horizon - 6,
      minH: 22,
      maxH: 52,
      seed: 44,
      palette: { top: '#2b6b58', bottom: '#1b4a3e', rim: '#4f9c7c' },
      hazeColour: '#cfeede',
      hazeAmount: 0.42,
    }),
    0,
    0,
  );

  const far = rng(5);
  for (let i = 0; i < 16; i++) pine(c, far.int(-4, W + 4), horizon - 2, far.int(22, 34), '#255f4c', '#347a60');
  const mid = rng(15);
  for (let i = 0; i < 11; i++) pine(c, mid.int(-6, W + 6), horizon + 16, mid.int(34, 50), '#1b4d3e', '#276b50');

  groundBand(c, {
    top: horizon + 20,
    amplitude: 2,
    seed: 27,
    body: '#2d4a2a',
    rim: '#5f8f4a',
    bottomShade: '#10200f',
  });

  // Near trunks framing the right, where nothing else is competing for space.
  for (const [x, height] of [
    [140, 74],
    [162, 92],
  ]) {
    c.rect(x, H - height, 7, height, '#2a1a12');
    c.vline(x, H - height, height, '#4a3020');
    c.vline(x + 6, H - height, height, '#150d08');
  }
  pine(c, 116, H - 6, 58, '#153f34', '#20604a');

  // Roots and undergrowth along the floor.
  const ur = rng(61);
  for (let i = 0; i < 26; i++) {
    const x = ur.int(0, W - 10);
    const y = ur.int(horizon + 26, H - 3);
    c.hline(x, y, ur.int(3, 9), ur() < 0.5 ? '#3d6b33' : '#24401f');
  }
  return c;
}

/** Map 4 — Steel Yard. Container stacks and cranes against a cold dusk. */
export function heroSteelYard() {
  const horizon = 118;
  const c = skyOf(
    [
      [0, '#0a1030'],
      [0.55, '#25386e'],
      [1, '#7f93c8'],
    ],
    { horizon, seed: 18, stars: 26, starColours: ['#ffffff', '#cfe0ff'] },
  );

  const crane = (x, height, colour) => {
    c.rect(x, horizon - height, 4, height, colour);
    for (let y = horizon - height; y < horizon - 8; y += 9) c.line(x, y, x + 3, y + 9, colour);
    c.rect(x - 26, horizon - height, 60, 3, colour); // jib
    c.line(x + 2, horizon - height - 14, x - 22, horizon - height, colour);
    c.rect(x + 1, horizon - height - 14, 3, 14, colour);
    c.vline(x - 18, horizon - height + 3, 22, colour);
    c.rect(x - 21, horizon - height + 25, 7, 5, colour);
    c.rect(x + 28, horizon - height - 2, 7, 7, colour);
  };
  crane(40, 74, '#2b3a63');
  crane(126, 92, '#36487a');

  // Yard floor.
  c.gradient(0, horizon, W, H - horizon, [
    [0, '#2a2f42'],
    [1, '#15182a'],
  ]);
  c.hline(0, horizon, W, '#4a5580');

  // Container stacks. Kept to the right and centre so the copy block stays clear.
  const palette = ['#c4553a', '#3f7ea8', '#c8973a', '#4a8a5c', '#8a4a7a'];
  const r = rng(84);
  const stack = (x, baseY, cols, rows) => {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const w = 30;
        const h = 13;
        const bx = x + col * (w + 2);
        const by = baseY - (row + 1) * (h + 2);
        const colour = r.pick(palette);
        c.rect(bx, by, w, h, colour);
        c.hline(bx, by, w, mix(colour, '#ffffff', 0.35));
        c.hline(bx, by + h - 1, w, mix(colour, '#000000', 0.45));
        for (let i = 2; i < w - 2; i += 3) c.vline(bx + i, by + 2, h - 4, mix(colour, '#000000', 0.18));
      }
    }
  };
  stack(96, H - 6, 2, 3);
  stack(4, H - 4, 2, 1);
  stack(58, H - 30, 1, 1);

  // Lamp glow over the yard, so the metal reads as lit rather than flat.
  glow(c, 128, horizon - 84, 26, '#ffe6a0', 0.3);
  return c;
}

/** Map 5 — Magma Ridge. A lava cone, black rock, and cracks glowing through the foreground. */
export function heroMagmaRidge() {
  const horizon = 120;
  const c = skyOf(
    [
      [0, '#180512'],
      [0.5, '#5a1220'],
      [1, '#c4452a'],
    ],
    { horizon, seed: 6, clouds: { count: 5, high: '#00000055', mid: '#3a0d1899', low: '#ff6a3a88' } },
  );

  c.blit(
    mesaLayer({
      w: W,
      h: H,
      base: horizon - 4,
      minH: 20,
      maxH: 58,
      seed: 52,
      palette: { top: '#3a1c22', bottom: '#1a0c10', rim: '#6b2a26' },
      hazeColour: '#ff7a46',
      hazeAmount: 0.3,
    }),
    0,
    0,
  );

  // The cone itself, off to the right with lava running down its left face.
  const peakX = 122;
  const peakY = 36;
  c.polygon(
    [
      [peakX, peakY],
      [peakX + 46, horizon],
      [peakX - 48, horizon],
    ],
    '#241014',
  );
  c.line(peakX, peakY, peakX - 48, horizon, '#54232a');
  glow(c, peakX, peakY + 2, 22, '#ff8a3a', 0.55);
  c.polygon(
    [
      [peakX - 5, peakY + 1],
      [peakX + 6, peakY + 1],
      [peakX + 2, peakY + 16],
      [peakX - 3, peakY + 14],
    ],
    '#ffd06a',
  );
  const lr = rng(70);
  let lx = peakX - 1;
  for (let y = peakY + 6; y < horizon; y += 2) {
    lx += lr.int(-2, 1);
    c.hline(lx, y, lr.int(2, 4), '#ff7a2a');
    c.set(lx + 1, y, '#ffd48a');
  }

  groundBand(c, {
    top: horizon + 2,
    amplitude: 3,
    seed: 47,
    body: '#231216',
    rim: '#5c2a28',
    bottomShade: '#0b0507',
  });

  // Cracks in the cooled crust, lit from underneath.
  const cr = rng(91);
  for (let i = 0; i < 9; i++) {
    let x = cr.int(0, W - 1);
    let y = cr.int(horizon + 10, H - 6);
    for (let step = 0; step < cr.int(8, 22); step++) {
      c.set(x, y, '#ff6a2a');
      c.set(x, y + 1, '#8a2a14');
      glow(c, x, y, 3, '#ff8a3a', 0.22);
      x += cr.int(-1, 2);
      y += cr.int(-1, 1);
    }
  }
  return c;
}

/** Map 6 — Frost Peak. Pale sky, snow mountains, drifts and snow-laden pines. */
export function heroFrostPeak() {
  const horizon = 116;
  const c = skyOf(
    [
      [0, '#123a64'],
      [0.5, '#5b9ccc'],
      [1, '#d8eefc'],
    ],
    { horizon, seed: 14, stars: 14, starColours: ['#eaf6ff'], clouds: { count: 4, high: '#ffffff55', mid: '#ffffff99', low: '#cfe6f855' } },
  );

  c.blit(
    mesaLayer({
      w: W,
      h: H,
      base: horizon - 8,
      minH: 34,
      maxH: 76,
      seed: 63,
      palette: { top: '#f2f9ff', bottom: '#7fa4c4', rim: '#ffffff' },
      hazeColour: '#dcecfa',
      hazeAmount: 0.4,
    }),
    0,
    0,
  );
  c.blit(
    mesaLayer({
      w: W,
      h: H,
      base: horizon,
      minH: 20,
      maxH: 46,
      seed: 71,
      palette: { top: '#ffffff', bottom: '#5f89ad', rim: '#ffffff' },
      hazeColour: '#e8f4ff',
      hazeAmount: 0.16,
    }),
    0,
    0,
  );

  groundBand(c, {
    top: horizon + 12,
    amplitude: 3,
    seed: 38,
    body: '#dbeaf7',
    rim: '#ffffff',
    bottomShade: '#8fb0cc',
  });

  pine(c, 26, H - 18, 52, '#1d4438', '#2a6650', true);
  pine(c, 150, H - 10, 44, '#1d4438', '#2a6650', true);
  pine(c, 120, H - 26, 30, '#234f40', '#2f7057', true);

  // Falling snow, thicker low down where it reads against the dark trees.
  const sr = rng(55);
  for (let i = 0; i < 120; i++) {
    const x = sr.int(0, W - 1);
    const y = sr.int(10, H - 1);
    c.set(x, y, y > horizon ? '#ffffff' : '#eaf6ffcc');
  }
  return c;
}

/** Map 7 — Orbit Circuit. Night, a ringed planet, and a neon track running to the horizon. */
export function heroOrbitCircuit() {
  const horizon = 122;
  const c = skyOf(
    [
      [0, '#06021a'],
      [0.55, '#1d0a42'],
      [1, '#5a2a86'],
    ],
    { horizon, seed: 3, stars: 120, starColours: ['#ffffff', '#cfc0ff', '#9fd8ff', '#ffd6f0'] },
  );

  // Ringed planet, upper right but below the countdown chip.
  const px = 132;
  const py = 54;
  glow(c, px, py, 34, '#7a4ad0', 0.3);
  c.circle(px, py, 21, '#5b3a9e');
  c.circle(px - 6, py - 6, 13, '#7a55c8');
  c.circle(px - 10, py - 9, 6, '#9a78e8');
  for (let x = px - 38; x <= px + 38; x++) {
    const t = (x - px) / 38;
    const y = py + 13 + Math.round(t * 5);
    c.set(x, y, '#c8a0ff');
    c.set(x, y + 1, '#8a5ad0');
    if (Math.abs(x - px) > 22) c.set(x, y - 1, '#e0c8ff');
  }
  c.circle(px, py, 21, '#5b3a9e'); // planet redrawn over the near half of the ring

  // A smaller moon, low and left, kept dim so it does not fight the text.
  c.circle(30, 40, 7, '#3a2a5e');
  c.circle(28, 38, 4, '#584280');

  const surface = groundBand(c, {
    top: horizon,
    amplitude: 2,
    seed: 29,
    body: '#18103a',
    rim: '#6a4ad0',
    bottomShade: '#070418',
  });

  // Neon edge strips running along the surface: the map's signature.
  for (let x = 0; x < W; x++) {
    const y = surface[x];
    c.set(x, y - 1, '#c8a0ff');
    if (x % 9 < 5) c.set(x, y - 3, '#35d6ff');
  }
  const gr = rng(88);
  for (let i = 0; i < 7; i++) {
    const x = gr.int(6, W - 10);
    const y = surface[x] + gr.int(6, 30);
    c.rect(x, y, gr.int(4, 10), 2, '#35d6ff');
    glow(c, x + 3, y, 6, '#35d6ff', 0.25);
  }
  return c;
}

export const HERO_SCENES = [
  ['scenes/hero-coral-coast.png', heroCoralCoast],
  ['scenes/hero-emerald-woods.png', heroEmeraldWoods],
  ['scenes/hero-steel-yard.png', heroSteelYard],
  ['scenes/hero-magma-ridge.png', heroMagmaRidge],
  ['scenes/hero-frost-peak.png', heroFrostPeak],
  ['scenes/hero-orbit-circuit.png', heroOrbitCircuit],
];
