import { CANYON, drawGround, mesaLayer, sky } from './canyon.mjs';
import { Canvas, rng } from './lib/pixel.mjs';

/** The 7 weekly maps: provisional names (decision C3) and one thumbnail each (46x28 art px). */
const W = 46;
const H = 28;

function pine(c, cx, baseY, h, body, lit, snow = false) {
  const tiers = Math.max(2, Math.round(h / 5));
  for (let i = 0; i < tiers; i++) {
    const top = baseY - h + Math.round((i * h) / tiers);
    const tierH = Math.round(h / tiers) + 3;
    const half = 2 + Math.round(((i + 1) * (h / 3)) / tiers);
    c.polygon(
      [
        [cx, top],
        [cx + half, top + tierH],
        [cx - half, top + tierH],
      ],
      body,
    );
    c.line(cx, top, cx - half, top + tierH, lit);
    if (snow)
      c.hline(cx - Math.max(0, half - 2), top + tierH - 1, Math.max(1, half * 2 - 3), '#f4fbff');
  }
  c.rect(cx, baseY - 2, 1, 2, '#3a2418');
}

function palm(c, x, baseY, h) {
  let topX = x;
  for (let i = 0; i < h; i++) {
    const dx = Math.round(Math.sin((i / h) * 1.6) * 3);
    c.set(x + dx, baseY - i, '#7a4a2a');
    c.set(x + 1 + dx, baseY - i, '#a86a3a');
    topX = x + dx;
  }
  const topY = baseY - h;
  for (const [dx, dy] of [
    [-7, 1],
    [-5, -3],
    [-1, -5],
    [4, -4],
    [7, 0],
    [5, 3],
    [-4, 4],
  ]) {
    c.line(topX, topY, topX + dx, topY + dy, '#1f8a4a');
    c.set(topX + dx, topY + dy + 1, '#5ad07a');
  }
  c.rect(topX - 1, topY, 3, 2, '#5a3a20');
}

function crane(c, x, baseY, h, col) {
  c.rect(x, baseY - h, 2, h, col);
  for (let y = baseY - h; y < baseY - 3; y += 4) c.line(x, y, x + 1, y + 4, col);
  c.rect(x - 11, baseY - h, 26, 1, col); // jib
  c.line(x + 1, baseY - h, x - 8, baseY - h + 4, col);
  c.vline(x - 9, baseY - h, 8, col); // hoist line
  c.rect(x - 10, baseY - h + 8, 3, 2, col);
  c.rect(x + 12, baseY - h - 1, 3, 3, col); // counterweight
}

export function thumbCanyon() {
  const c = sky(W, H, 20, { x: 30, y: 14, r: 3 });
  c.blit(
    mesaLayer({ w: W, h: H, base: 19, minH: 4, maxH: 13, seed: 3, palette: CANYON.far }),
    0,
    0,
  );
  c.blit(
    mesaLayer({ w: W, h: H, base: 22, minH: 3, maxH: 11, seed: 4, palette: CANYON.mid }),
    0,
    0,
  );
  drawGround(
    c,
    [
      [0, 24],
      [22, 23],
      [46, 24],
    ],
    H,
    2,
  );
  c.rect(35, 13, 1, 11, '#7f4a2c');
  c.rect(41, 13, 1, 11, '#7f4a2c');
  c.rect(34, 13, 9, 1, '#a96a38');
  c.rect(38, 6, 1, 7, '#d9d2ff');
  for (const [x, y, dark] of [
    [39, 6, false],
    [41, 6, true],
    [39, 8, true],
    [41, 8, false],
  ])
    c.rect(x, y, 2, 2, dark ? '#191325' : '#f4f1ff');
  // tiny rider silhouette
  c.circle(9, 22, 1, '#150b1e');
  c.circle(15, 22, 1, '#150b1e');
  c.rect(9, 19, 7, 3, '#150b1e');
  c.rect(11, 16, 2, 3, '#3f5cc0');
  return c;
}

export function thumbBeach() {
  const c = new Canvas(W, H);
  c.gradient(0, 0, W, 16, [
    [0, '#2a8fd0'],
    [0.55, '#7fd0ec'],
    [1, '#d9f4f0'],
  ]);
  c.polygon(
    [
      [24, 16],
      [29, 11],
      [36, 10],
      [42, 13],
      [46, 16],
    ],
    '#2f7a8a',
  );
  c.hline(29, 11, 8, '#4aa0a8');
  c.gradient(0, 15, W, 9, [
    [0, '#1b9ac9'],
    [1, '#5fd0e0'],
  ]);
  const r = rng(4);
  for (let i = 0; i < 12; i++) c.set(r.int(18, 45), r.int(16, 22), '#ffffff');
  c.polygon(
    [
      [0, 22],
      [16, 21],
      [30, 24],
      [46, 25],
      [46, 28],
      [0, 28],
    ],
    '#f2d9a0',
  );
  c.line(0, 22, 16, 21, '#fff2c8');
  c.line(16, 21, 30, 24, '#fff2c8');
  c.hline(0, 27, W, '#d9b878');
  palm(c, 8, 25, 14);
  return c;
}

export function thumbForest() {
  const c = new Canvas(W, H);
  c.gradient(0, 0, W, H, [
    [0, '#134a63'],
    [0.55, '#2f8f8a'],
    [1, '#a4e0b0'],
  ]);
  for (let x = 6; x < W; x += 14)
    for (let y = 0; y < 24; y++) {
      const xx = x + Math.round(y * 0.45);
      c.set(xx, y, '#d8ffd866');
      c.set(xx + 1, y, '#d8ffd844');
    }
  for (const x of [5, 15, 25, 35, 44]) pine(c, x, 25, 15, '#1c6a6a', '#4ab8a0');
  for (const x of [10, 21, 32, 42]) pine(c, x, 26, 19, '#0f4a52', '#2f9a8a');
  for (const [x, h] of [
    [3, 27],
    [27, 21],
    [40, 25],
  ])
    pine(c, x, 28, h, '#062a34', '#1f7a70');
  c.rect(0, 25, W, 3, '#062a26');
  c.hline(0, 25, W, '#3fa070');
  for (const [x, y] of [
    [16, 15],
    [30, 12],
    [35, 19],
  ])
    c.set(x, y, '#f4ffb0');
  return c;
}

export function thumbIndustrial() {
  const c = new Canvas(W, H);
  c.gradient(0, 0, W, H, [
    [0, '#26377f'],
    [0.5, '#8a5a9e'],
    [0.85, '#ff9a5a'],
    [1, '#ffc078'],
  ]);
  c.circle(35, 20, 4, '#ffe6a0');
  const sil = '#0b1030';
  c.rect(2, 14, 6, 10, sil);
  c.rect(9, 10, 5, 14, sil);
  c.rect(15, 16, 8, 8, sil);
  c.polygon(
    [
      [26, 24],
      [28, 14],
      [34, 14],
      [36, 24],
    ],
    sil,
  );
  c.rect(39, 8, 3, 16, sil);
  for (const [x, y, r] of [
    [40, 5, 2],
    [42, 3, 2],
    [44, 2, 2],
  ])
    c.circle(x, y, r, '#5a4a7a99');
  crane(c, 19, 24, 19, sil);
  for (const [x, y] of [
    [4, 17],
    [6, 20],
    [10, 13],
    [12, 17],
    [17, 19],
    [21, 21],
  ])
    c.set(x, y, '#ffd070');
  c.rect(0, 24, W, 4, '#0b1030');
  c.hline(0, 24, W, '#3a3a70');
  c.rect(2, 22, 5, 2, '#7a3a4a');
  c.rect(8, 22, 5, 2, '#3a4a7a');
  c.rect(30, 22, 6, 2, '#7a5a3a');
  return c;
}

export function thumbVolcano() {
  const c = new Canvas(W, H);
  c.gradient(0, 0, W, H, [
    [0, '#160a1c'],
    [0.5, '#4a1226'],
    [0.85, '#c2331e'],
    [1, '#ff8a2e'],
  ]);
  for (const [x, y, r] of [
    [21, 6, 4],
    [26, 4, 5],
    [32, 7, 4],
    [17, 8, 3],
  ])
    c.circle(x, y, r, '#2a1424cc');
  c.polygon(
    [
      [6, 25],
      [19, 10],
      [27, 10],
      [40, 25],
    ],
    '#1a0e18',
  );
  c.hline(19, 10, 9, '#ff7a2e');
  c.line(21, 11, 17, 17, '#ff8a2e');
  c.line(17, 17, 19, 23, '#ff8a2e');
  c.line(25, 11, 29, 16, '#ffd24a');
  c.line(29, 16, 27, 24, '#ff8a2e');
  c.rect(0, 25, W, 3, '#120a14');
  for (const [x, y, x2, y2] of [
    [4, 26, 9, 26],
    [14, 27, 20, 26],
    [32, 26, 40, 27],
  ])
    c.line(x, y, x2, y2, '#ff6a2a');
  const r = rng(6);
  for (let i = 0; i < 10; i++) c.set(r.int(2, 44), r.int(2, 20), '#ffb060');
  return c;
}

export function thumbSnow() {
  const c = new Canvas(W, H);
  c.gradient(0, 0, W, H, [
    [0, '#3a5fd0'],
    [0.6, '#a8c8ff'],
    [1, '#e8f4ff'],
  ]);
  const peak = (cx, base, h, half) => {
    c.polygon(
      [
        [cx - half, base],
        [cx, base - h],
        [cx + half, base],
      ],
      '#7fa0e0',
    );
    c.polygon(
      [
        [cx, base - h],
        [cx + half, base],
        [cx + 2, base],
      ],
      '#5a7ac0',
    );
    c.polygon(
      [
        [cx, base - h],
        [cx + Math.round(half * 0.45), base - h + Math.round(h * 0.4)],
        [cx + 1, base - h + Math.round(h * 0.3)],
        [cx - 2, base - h + Math.round(h * 0.42)],
        [cx - Math.round(half * 0.45), base - h + Math.round(h * 0.4)],
      ],
      '#ffffff',
    );
  };
  peak(10, 24, 17, 11);
  peak(27, 24, 21, 14);
  peak(40, 24, 13, 9);
  pine(c, 5, 27, 10, '#1a4a4a', '#2f7a6a', true);
  pine(c, 36, 27, 12, '#1a4a4a', '#2f7a6a', true);
  pine(c, 43, 27, 9, '#1a4a4a', '#2f7a6a', true);
  c.rect(0, 25, W, 3, '#f4fbff');
  c.hline(0, 25, W, '#ffffff');
  c.hline(0, 27, W, '#c8dcff');
  const r = rng(12);
  for (let i = 0; i < 12; i++) c.set(r.int(0, 45), r.int(0, 22), '#ffffff');
  return c;
}

export function thumbSpace() {
  const c = new Canvas(W, H);
  c.gradient(0, 0, W, H, [
    [0, '#07041a'],
    [0.7, '#1a1050'],
    [1, '#3a1a7a'],
  ]);
  const r = rng(9);
  for (let i = 0; i < 40; i++) c.set(r.int(0, 45), r.int(0, 21), r() < 0.7 ? '#ffffff' : '#a8b8ff');
  const planet = (cx, cy, rad, dark, light, lx, ly) => {
    for (let y = -rad; y <= rad; y++)
      for (let x = -rad; x <= rad; x++) {
        if (x * x + y * y > rad * rad + rad * 0.8) continue;
        const lit = (x - lx) * (x - lx) + (y - ly) * (y - ly) <= (rad - 1) * (rad - 1) + rad;
        c.set(cx + x, cy + y, lit ? light : dark);
      }
  };
  planet(13, 11, 7, '#4a2a7a', '#8a52c0', -2, -2);
  c.hline(6, 12, 15, '#a06ad8aa');
  planet(35, 9, 6, '#1f3a90', '#4a8af0', -2, -1);
  c.polygon(
    [
      [0, 23],
      [10, 22],
      [24, 24],
      [36, 22],
      [46, 23],
      [46, 28],
      [0, 28],
    ],
    '#1a1338',
  );
  c.line(0, 23, 10, 22, '#35d6ff');
  c.line(10, 22, 24, 24, '#35d6ff');
  c.line(24, 24, 36, 22, '#35d6ff');
  c.line(36, 22, 46, 23, '#35d6ff');
  c.ellipse(14, 26, 3, 1, '#0c0820');
  c.ellipse(32, 26, 4, 1, '#0c0820');
  return c;
}

export const MAPS = [
  {
    n: 1,
    slug: 'sunset-canyon',
    day: 'MON',
    name: 'Sunset Canyon',
    accent: '#ff8a3a',
    difficulty: 1,
    thumb: thumbCanyon,
    tagline: 'Speed through the rocks. Master the jumps. Beat the clock.',
  },
  {
    n: 2,
    slug: 'coral-coast',
    day: 'TUE',
    name: 'Coral Coast',
    accent: '#3ad0e0',
    difficulty: 2,
    thumb: thumbBeach,
    tagline: 'Ride the shoreline. Do not touch the water.',
  },
  {
    n: 3,
    slug: 'emerald-woods',
    day: 'WED',
    name: 'Emerald Woods',
    accent: '#3aa07a',
    difficulty: 2,
    thumb: thumbForest,
    tagline: 'Roots, logs and long jumps between the pines.',
  },
  {
    n: 4,
    slug: 'steel-yard',
    day: 'THU',
    name: 'Steel Yard',
    accent: '#7a8aff',
    difficulty: 3,
    thumb: thumbIndustrial,
    tagline: 'Cranes, containers and tight landings.',
  },
  {
    n: 5,
    slug: 'magma-ridge',
    day: 'FRI',
    name: 'Magma Ridge',
    accent: '#ff5a2a',
    difficulty: 4,
    thumb: thumbVolcano,
    tagline: 'Hot rock. Cold nerves.',
  },
  {
    n: 6,
    slug: 'frost-peak',
    day: 'SAT',
    name: 'Frost Peak',
    accent: '#8ac8ff',
    difficulty: 4,
    thumb: thumbSnow,
    tagline: 'Slippery slopes and huge air.',
  },
  {
    n: 7,
    slug: 'orbit-circuit',
    day: 'SUN',
    name: 'Orbit Circuit',
    accent: '#a06ad8',
    difficulty: 5,
    thumb: thumbSpace,
    tagline: 'The final race of the week.',
  },
];
