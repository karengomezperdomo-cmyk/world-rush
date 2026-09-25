import { bikeSprite, riderRagdoll } from './bike.mjs';
import { explosionFrame } from './fx.mjs';
import { Canvas, drawText, mix, rng, rotateSprite } from './lib/pixel.mjs';

/** Sunset Canyon (map 1, provisional art). Palette follows the mock: deep purples into a hot orange horizon. */
export const CANYON = {
  skyStops: [
    [0, '#2b1a4f'],
    [0.22, '#5b2a6e'],
    [0.42, '#a3407a'],
    [0.6, '#e0555a'],
    [0.74, '#ff8440'],
    [0.88, '#ffb650'],
    [1, '#ffe08f'],
  ],
  far: { top: '#b45a86', bottom: '#e07a66', rim: '#ffb27a' },
  mid: { top: '#8a3560', bottom: '#c04e5a', rim: '#ffa458' },
  near: { top: '#40203f', bottom: '#28122f', rim: '#ff8a3a' },
  cliff: { top: '#4a2a5a', bottom: '#231338', rim: '#ff9a4a' },
  stone: ['#2e1220', '#4d1f27', '#722f2b', '#9a4a30', '#c2693a', '#e88d43'],
  wood: ['#2f1a1c', '#552d24', '#7f4a2c', '#a96a38', '#d29552'],
  cactus: ['#0f2a1a', '#1f4a2b', '#2f7a3d', '#5ab55a', '#9be08a'],
};

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Dithered radial glow (retro halo). */
function glow(c, cx, cy, radius, colour, strength) {
  for (let y = cy - radius; y <= cy + radius; y++)
    for (let x = cx - radius; x <= cx + radius; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius) continue;
      const t = (1 - d / radius) * strength;
      if (t > (BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16) c.set(x, y, colour);
    }
}

/** Sky whose full gradient fits between the top and `horizon`, so the orange band is actually visible. */
export function sky(w, h, horizon, sun) {
  const c = new Canvas(w, h);
  c.gradient(0, 0, w, horizon, CANYON.skyStops);
  c.rect(0, horizon, w, h - horizon, '#ffe08f');
  const r = rng(7);
  for (let i = 0; i < Math.floor(w / 5); i++)
    c.set(r.int(0, w - 1), r.int(0, Math.floor(horizon * 0.25)), r() < 0.5 ? '#fff2d0' : '#f0c8ff');
  if (sun) {
    glow(c, sun.x, sun.y, Math.round(sun.r * 3.2), '#ffd47a', 0.5);
    glow(c, sun.x, sun.y, Math.round(sun.r * 1.9), '#fff0b0', 0.8);
    c.circle(sun.x, sun.y, sun.r, '#fff6cc');
    c.circle(sun.x, sun.y, sun.r - 3, '#ffffe8');
  }
  const cr = rng(11);
  for (let i = 0; i < Math.max(3, Math.floor(w / 40)); i++) {
    const len = cr.int(20, 50);
    const x = cr.int(-10, w - 10);
    const y = cr.int(Math.floor(horizon * 0.2), Math.floor(horizon * 0.62));
    c.hline(x + 3, y, len - 6, '#4a226099');
    c.hline(x, y + 1, len, '#5b2a6ecc');
    c.hline(x + 2, y + 2, len - 4, '#ff9a5acc');
  }
  return c;
}

/**
 * Silhouette layer (transparent above the skyline). `light` says which cliff faces catch the sun.
 */
export function mesaLayer({
  w,
  h,
  base,
  minH,
  maxH,
  seed,
  palette,
  hazeColour,
  hazeAmount = 0,
  strataEvery = 6,
  light = 'right',
}) {
  const r = rng(seed);
  const top = new Array(w).fill(base - minH);
  let x = 0;
  while (x < w) {
    const segW = r.int(10, 30);
    const height = r.int(minH, maxH);
    const shape = r.pick(['flat', 'flat', 'slope', 'spire', 'notch']);
    for (let i = 0; i < segW && x + i < w; i++) {
      let hh = height;
      if (shape === 'slope') hh = height - Math.floor(i * 0.45);
      if (shape === 'spire' && i > segW * 0.35 && i < segW * 0.65) hh = height + r.int(6, 12);
      if (shape === 'notch' && i % 7 === 3) hh -= 2;
      top[x + i] = base - hh;
    }
    x += segW;
  }
  for (let i = 0; i < w; i++) if (r() < 0.08) top[i] += 1; // erosion bites
  const c = new Canvas(w, h);
  const strata = Array.from({ length: Math.ceil(w / 6) }, () => r.int(0, strataEvery - 1));
  for (let px = 0; px < w; px++) {
    const t = top[px];
    const neighbour = top[light === 'right' ? (px + 1) % w : (px - 1 + w) % w];
    for (let py = t; py < h; py++) {
      const depth = py - t;
      const norm = Math.min(1, depth / Math.max(1, h - t));
      let colour = mix(palette.top, palette.bottom, norm);
      if ((py + strata[Math.floor(px / 6)]) % strataEvery === 0)
        colour = mix(colour, '#00000040', 0.5);
      if (hazeColour) colour = mix(colour, hazeColour, hazeAmount * (1 - norm * 0.4));
      if (depth === 0) colour = palette.rim;
      else if (neighbour > t + 1 && py < neighbour) colour = mix(colour, palette.rim, 0.75); // sun-facing cliff
      c.set(px, py, colour);
    }
  }
  return c;
}

/** Dry-stone / cobbled rock texture (mortar lines, lit tops, cracks). */
export function stoneTexture(w, h, seed, ramp = CANYON.stone) {
  const r = rng(seed);
  const c = new Canvas(w, h);
  c.fill(ramp[0]);
  let y = 0;
  while (y < h) {
    const rowH = r.int(5, 7);
    let x = -r.int(0, 8);
    while (x < w) {
      const bw = r.int(9, 16);
      const tone = r.int(2, 4);
      const base = ramp[tone];
      c.rect(x + 1, y + 1, bw - 1, rowH - 1, base);
      c.hline(x + 1, y + 1, bw - 1, ramp[Math.min(5, tone + 1)]);
      c.vline(x + 1, y + 1, rowH - 1, ramp[Math.min(5, tone + 1)]);
      c.hline(x + 1, y + rowH - 1, bw - 1, ramp[tone - 1]);
      for (let k = 0; k < 2; k++)
        if (r() < 0.6) c.set(x + r.int(2, bw - 2), y + r.int(2, rowH - 2), ramp[tone - 1]);
      x += bw;
    }
    y += rowH;
  }
  return c;
}

/** Piecewise-linear ground height at x. points = [[x, y], ...] sorted by x (repeated x = vertical wall). */
export function groundY(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

/** Fills everything under a ground polyline with lit-lip stone. The brick pattern stays axis-aligned. */
export function drawGround(c, points, bottom, seed = 5) {
  const tex = stoneTexture(64, 64, seed);
  const S = CANYON.stone;
  for (let x = 0; x < c.w; x++) {
    const y0 = Math.round(groundY(points, x));
    for (let y = y0; y < bottom; y++) {
      const d = y - y0;
      let colour;
      if (d === 0) colour = '#ffc06a';
      else if (d === 1) colour = S[5];
      else if (d === 2) colour = S[4];
      else colour = tex.get(x % tex.w, y % tex.h);
      // fade into shadow quickly: the lower part of the screen carries the on-screen controls
      const shade = Math.min(0.86, Math.max(0, (d - 3) / 44));
      c.set(x, y, mix(colour, '#12081a', shade));
    }
  }
}

export function cactus(height, variant = 0) {
  const P = CANYON.cactus;
  const c = new Canvas(15, height + 2);
  const base = height + 1;
  const trunkX = 6;
  c.rect(trunkX, base - height, 4, height, P[2]);
  c.vline(trunkX, base - height, height, P[3]);
  c.vline(trunkX + 3, base - height, height, P[1]);
  c.rect(trunkX + 1, base - height - 1, 2, 1, P[3]);
  const arm = (side, y, len, up) => {
    const ax = side < 0 ? trunkX - len : trunkX + 4;
    c.rect(ax, base - y, len, 3, P[2]);
    c.hline(ax, base - y, len, P[3]);
    const vx = side < 0 ? ax : ax + len - 3;
    c.rect(vx, base - y - up, 3, up + 3, P[2]);
    c.vline(vx, base - y - up, up + 3, P[3]);
    c.vline(vx + 2, base - y - up, up + 3, P[1]);
  };
  arm(-1, Math.floor(height * 0.5), 4, 4 + variant);
  if (variant !== 1) arm(1, Math.floor(height * 0.65), 4, 3);
  const r = rng(height * 13 + variant);
  for (let i = 0; i < height / 2; i++)
    c.set(trunkX + r.int(0, 3), base - r.int(1, height - 1), P[4]);
  return c.outlined('#0b1a12');
}

/** Height of the ramp deck surface at x. */
export function rampSurface(ramp, x) {
  return ramp.y0 + ((ramp.y1 - ramp.y0) * (x - ramp.x0)) / (ramp.x1 - ramp.x0);
}

/** Wooden ramp deck (a bridge over a pit): posts and braces underneath, planks on top. */
export function drawWoodenRamp(c, ramp, groundBottom, thick = 7) {
  const W = CANYON.wood;
  const { x0, x1 } = ramp;
  const posts = [];
  for (let px = x0 + 6; px < x1 - 3; px += 14) posts.push(px);
  for (const px of posts) {
    const deckY = Math.round(rampSurface(ramp, px));
    c.rect(px, deckY + thick, 4, groundBottom - deckY - thick, W[1]);
    c.vline(px, deckY + thick, groundBottom - deckY - thick, W[3]);
    c.vline(px + 3, deckY + thick, groundBottom - deckY - thick, W[0]);
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const b = posts[i + 1];
    const ya = rampSurface(ramp, a) + thick + 3;
    c.line(a + 2, ya, b + 2, Math.min(groundBottom - 4, ya + 26), W[1], 2);
    c.line(b + 2, ya, a + 2, Math.min(groundBottom - 4, ya + 26), W[1], 2);
  }
  c.polygon(
    [
      [x0, ramp.y0],
      [x1, ramp.y1],
      [x1, ramp.y1 + thick],
      [x0, ramp.y0 + thick],
    ],
    W[2],
  );
  c.line(x0, ramp.y0 - 1, x1, ramp.y1 - 1, W[0]); // dark edge above the lit top (reads as a rim)
  c.line(x0, ramp.y0, x1, ramp.y1, W[4]);
  c.line(x0, ramp.y0 + 1, x1, ramp.y1 + 1, W[3]);
  c.line(x0, ramp.y0 + thick, x1, ramp.y1 + thick, W[0]);
  for (let px = x0 + 5; px < x1; px += 6) {
    const y = Math.round(rampSurface(ramp, px));
    c.vline(px, y + 2, thick - 2, W[1]);
    c.set(px + 1, y + 1, W[4]);
  }
}

function checkerFlag(w, h, wave = 1) {
  const c = new Canvas(w + 2, h + 4);
  const cell = 3;
  for (let x = 0; x < w; x++) {
    const dy = Math.round(Math.sin((x / w) * Math.PI * 1.5) * wave);
    for (let y = 0; y < h; y++) {
      const dark = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      c.set(x, y + 2 + dy, dark ? '#191325' : '#f4f1ff');
    }
  }
  return c.outlined('#0d0716');
}

export function drawGate(c, x, baseY, height) {
  const W = CANYON.wood;
  const postW = 4;
  const gap = 20;
  for (const px of [x, x + gap]) {
    c.rect(px, baseY - height, postW, height, W[2]);
    c.vline(px, baseY - height, height, W[4]);
    c.vline(px + postW - 1, baseY - height, height, W[1]);
  }
  c.rect(x - 4, baseY - height, gap + postW + 8, 4, W[2]);
  c.hline(x - 4, baseY - height, gap + postW + 8, W[4]);
  c.hline(x - 4, baseY - height + 3, gap + postW + 8, W[1]);
  const poleX = x + gap + 1;
  c.rect(poleX, baseY - height - 22, 2, 22, '#d9d2ff');
  c.blit(checkerFlag(15, 9, 1), poleX - 15, baseY - height - 24);
  const bx = x + 5;
  const by = baseY - height + 4;
  c.rect(bx, by, 14, 27, '#2b2352');
  c.rect(bx, by, 14, 2, '#3f3480');
  c.vline(bx, by, 27, '#3f3480');
  c.vline(bx + 13, by, 27, '#1a1438');
  c.rect(bx + 4, by + 5, 6, 1, '#ffc23e'); // crown
  c.rect(bx + 4, by + 3, 1, 2, '#ffc23e');
  c.rect(bx + 6, by + 2, 2, 3, '#ffc23e');
  c.rect(bx + 9, by + 3, 1, 2, '#ffc23e');
  drawText(c, 'JUST', bx + 2, by + 9, '#9fb0ff', { spacing: 0 });
  drawText(c, 'RIDE', bx + 2, by + 17, '#9fb0ff', { spacing: 0 });
}

function place(c, sprite, x, bottom) {
  c.blit(sprite, Math.round(x - sprite.w / 2), Math.round(bottom - sprite.h));
}

function shadow(c, x, y, w, colour = '#12081a99') {
  c.ellipse(Math.round(x), Math.round(y), Math.round(w / 2), 2, colour);
}

/** Muted graffiti painted on the cliff face (the mock's own tagline), slightly slanted. */
function graffiti(c, x, y) {
  const t = new Canvas(42, 40);
  const ink = '#6a58b8';
  const lines = ['GOOD', 'RIDERS', 'BETTER', 'HUMANS'];
  lines.forEach((line, i) => drawText(t, line, 2, 1 + i * 9, ink, { spacing: 0 }));
  // smiley
  t.ring(33, 36, 3, ink, 1);
  t.set(32, 35, ink);
  t.set(34, 35, ink);
  t.hline(32, 37, 3, ink);
  c.blit(rotateSprite(t, -12), x, y);
}

/**
 * Hero illustration for the Home card (175x183 art px). The text sits top-left, the rider on the ramp below it, and the
 * dark foreground rock at the bottom is where the PLAY NOW / LEADERBOARD buttons overlay.
 */
export function heroScene() {
  const W = 175;
  const H = 183;
  const c = sky(W, H, 118, { x: 86, y: 94, r: 8 });
  c.blit(
    mesaLayer({
      w: W,
      h: H,
      base: 110,
      minH: 14,
      maxH: 54,
      seed: 21,
      palette: CANYON.far,
      hazeColour: '#ffb070',
      hazeAmount: 0.22,
    }),
    0,
    0,
  );
  c.blit(
    mesaLayer({
      w: W,
      h: H,
      base: 124,
      minH: 16,
      maxH: 52,
      seed: 33,
      palette: CANYON.mid,
      hazeColour: '#e07050',
      hazeAmount: 0.14,
    }),
    0,
    0,
  );

  // right-hand cliff, lit on its left face by the setting sun
  const cliff = mesaLayer({
    w: 56,
    h: H,
    base: H,
    minH: 100,
    maxH: 128,
    seed: 77,
    palette: CANYON.cliff,
    strataEvery: 7,
    light: 'left',
  });
  c.blit(cliff, 121, 0);
  graffiti(c, 130, 90);
  const cactusTop = cactus(12, 1);
  c.blit(cactusTop, 160, H - 128 - cactusTop.h + 6);

  // ground: left ledge, pit crossed by the ramp bridge, hump towards the gate, deep foreground
  const ramp = { x0: 14, y0: 122, x1: 86, y1: 104 };
  const ground = [
    [0, 124],
    [16, 124],
    [17, 200],
    [82, 200],
    [83, 118],
    [102, 116],
    [116, 120],
    [128, 126],
    [150, 130],
    [175, 132],
  ];
  drawWoodenRamp(c, ramp, 200, 7);
  drawGround(c, ground, H, 3);
  drawGate(c, 98, 118, 46);
  const cac = cactus(16, 0);
  c.blit(cac, 2, 124 - cac.h + 3);
  const small = cactus(7, 1);
  c.blit(small, 90, 118 - small.h + 3);

  // rider on the ramp, nose up along the slope
  const bike = rotateSprite(bikeSprite({ lean: 0, spin: 25 }), -14);
  const bx = 50;
  shadow(c, bx + 2, rampSurface(ramp, bx) + 1, 28, '#12081a88');
  place(c, bike, bx, rampSurface(ramp, bx) + 3);

  const r = rng(99);
  for (let i = 0; i < 16; i++)
    c.set(26 + r.int(0, 16), 118 + r.int(-3, 3), r() < 0.5 ? '#ffb47a99' : '#ff8f5a66');
  return c;
}

/** Portrait gameplay frame (195x422 art px = 390x844 CSS at 2px per art pixel). */
export function gameplayFrame({ crash = false, height = 422, groundAt = 0.74 } = {}) {
  const W = 195;
  const H = height;
  const groundLevel = Math.round(H * groundAt);
  const horizon = groundLevel - 6;
  const c = sky(W, H, horizon, { x: 40, y: horizon - 30, r: 9 });
  c.blit(
    mesaLayer({
      w: W,
      h: H,
      base: groundLevel - 8,
      minH: 22,
      maxH: 70,
      seed: 41,
      palette: CANYON.far,
      hazeColour: '#ffb070',
      hazeAmount: 0.3,
    }),
    0,
    0,
  );
  c.blit(
    mesaLayer({
      w: W,
      h: H,
      base: groundLevel - 2,
      minH: 16,
      maxH: 48,
      seed: 52,
      palette: CANYON.mid,
      hazeColour: '#e07050',
      hazeAmount: 0.2,
    }),
    0,
    0,
  );
  c.blit(
    mesaLayer({
      w: W,
      h: H,
      base: groundLevel + 6,
      minH: 8,
      maxH: 26,
      seed: 63,
      palette: CANYON.near,
    }),
    0,
    0,
  );

  const g = groundLevel;
  const ground = [
    [0, g],
    [40, g],
    [68, g - 14],
    [78, g - 15],
    [79, g + 12],
    [92, g + 14],
    [138, g + 14],
    [160, g + 2],
    [195, g - 4],
  ];
  drawGround(c, ground, H, 8);

  const cac = cactus(14, 0);
  c.blit(cac, 10, groundY(ground, 18) - cac.h + 3);
  const cac2 = cactus(10, 1);
  c.blit(cac2, 120, groundY(ground, 126) - cac2.h + 3);
  const px = 172;
  const py = Math.round(groundY(ground, px));
  c.rect(px, py - 30, 2, 30, '#d9d2ff');
  c.polygon(
    [
      [px + 2, py - 30],
      [px + 16, py - 26],
      [px + 2, py - 21],
    ],
    '#35d6ff',
  );
  c.polygon(
    [
      [px + 2, py - 29],
      [px + 10, py - 26],
      [px + 2, py - 24],
    ],
    '#b8f0ff',
  );

  if (!crash) {
    const bike = rotateSprite(bikeSprite({ lean: -1, spin: 40 }), -20);
    shadow(c, 96, groundY(ground, 96) + 2, 24, '#12081a77');
    place(c, bike, 88, groundY(ground, 84) - 22);
    const r = rng(5);
    for (let i = 0; i < 26; i++)
      c.set(
        52 + r.int(-8, 12),
        groundY(ground, 56) - r.int(0, 7),
        r() < 0.5 ? '#ffc890aa' : '#ff9a6a77',
      );
  } else {
    const bx = 108;
    const by = groundY(ground, bx);
    const wreck = rotateSprite(bikeSprite({ lean: 1, spin: 70, rider: false }), 150);
    place(c, wreck, bx + 6, by - 2);
    const dude = rotateSprite(riderRagdoll(2), 20);
    place(c, dude, bx - 22, by - 40);
    place(c, explosionFrame(3), bx + 2, by + 4);
  }
  return c;
}
