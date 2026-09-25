import { Canvas } from './lib/pixel.mjs';

/**
 * Provisional hero bike + rider (facing right), ~40x30 art pixels including the 1px outline.
 * Rider: navy suit with yellow accents and a white helmet so it reads against both the orange sunset and
 * the dark canyon shadows. Bike: red-orange body, gold forks, black knobbies.
 */
export const BIKE_COLOURS = {
  outline: '#150b1e',
  tire: '#1c1826',
  tireLight: '#3b3550',
  rim: '#aab0c8',
  hubDark: '#2c2a3c',
  gold: '#e8b043',
  goldLight: '#ffd76a',
  red: '#e8452b',
  redLight: '#ff7a4a',
  redDark: '#a12a25',
  silver: '#b9bdd0',
  silverDark: '#7f849d',
  engine: '#3a3a4c',
  engineDark: '#262637',
  seat: '#241a2a',
  seatLight: '#3a2c44',
  navy: '#22357a',
  navyLight: '#3f5cc0',
  navyDark: '#16224f',
  white: '#f4f1ff',
  whiteShade: '#b8b3d4',
  visor: '#35d6ff',
  visorDark: '#1a7fa6',
  boot: '#2a1c2e',
  yellow: '#ffc23e',
};

const C = BIKE_COLOURS;

function drawWheel(c, cx, cy, spinDeg) {
  c.circle(cx, cy, 5, C.tire);
  // knobby tread: lighter blocks around the outer edge, rotating with the wheel
  for (let k = 0; k < 12; k++) {
    const a = ((spinDeg + k * 30) * Math.PI) / 180;
    c.set(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, k % 2 === 0 ? C.tireLight : C.tire);
  }
  c.ring(cx, cy, 2, C.rim, 1); // thin silver rim: most of the wheel stays black tyre
  c.circle(cx, cy, 1, C.hubDark);
  const rad = (spinDeg * Math.PI) / 180;
  for (let k = 0; k < 3; k++) {
    const a = rad + (k * Math.PI) / 3;
    c.line(
      cx - Math.cos(a) * 2,
      cy - Math.sin(a) * 2,
      cx + Math.cos(a) * 2,
      cy + Math.sin(a) * 2,
      C.rim,
    );
  }
  c.set(cx, cy, C.gold);
}

/**
 * @param {{ lean?: number, spin?: number, rider?: boolean }} pose
 *   lean: -1 (rider leaning back) .. 0 (neutral) .. 1 (rider hunched forward)
 */
export function bikeSprite({ lean = 0, spin = 20, rider = true } = {}) {
  const c = new Canvas(38, 28);
  const RW = [8, 20];
  const FW = [30, 20];

  // --- rear of the bike ---
  drawWheel(c, RW[0], RW[1], spin);
  c.line(RW[0], RW[1], 15, 18, C.silverDark, 2); // swingarm
  c.line(10, 13, 12, 18, C.gold); // shock
  c.line(13, 15, 4, 13, C.silver, 2); // muffler
  c.set(4, 13, C.engineDark);
  c.set(4, 14, C.engineDark);
  c.polygon(
    [
      [2, 12],
      [9, 11],
      [10, 14],
      [3, 14],
    ],
    C.red,
  ); // rear fender / tail
  c.hline(3, 12, 5, C.redLight);
  c.rect(5, 12, 3, 2, C.white); // number plate
  c.set(6, 13, C.yellow);

  // --- engine (raised for ground clearance) ---
  c.rect(14, 14, 8, 6, C.engine);
  c.rect(16, 13, 4, 3, C.silverDark);
  c.circle(17, 18, 2, C.silver);
  c.set(17, 18, C.engineDark);
  c.hline(14, 19, 8, C.engineDark);

  // --- front end ---
  drawWheel(c, FW[0], FW[1], spin + 25);
  c.line(FW[0], FW[1], 28, 15, C.gold, 2); // lower fork (gold)
  c.line(28, 15, 25, 10, C.silver, 2); // upper fork
  c.set(29, 17, C.goldLight);
  // raised, beaked front fender (the tell-tale of a motocross bike)
  c.polygon(
    [
      [27, 11],
      [31, 10],
      [36, 13],
      [36, 14],
      [31, 12],
      [27, 13],
    ],
    C.red,
  );
  c.hline(28, 10, 3, C.redLight);
  c.rect(26, 8, 4, 4, C.white); // front number plate
  c.set(28, 10, C.yellow);

  // --- tank + seat ---
  c.polygon(
    [
      [16, 11],
      [24, 10],
      [26, 12],
      [25, 15],
      [17, 15],
    ],
    C.red,
  );
  c.hline(17, 11, 7, C.redLight);
  c.hline(18, 14, 7, C.redDark);
  c.rect(9, 11, 8, 2, C.seat);
  c.hline(9, 11, 8, C.seatLight);

  // --- handlebar ---
  c.line(24, 9, 28, 8, C.seat, 2);
  c.set(28, 9, C.seat);

  if (!rider) return c.outlined(C.outline);

  // --- rider ---
  const shoulder = [18 + 2 * lean, 6 + lean];
  const hip = [12 - lean, 10];
  c.line(hip[0] + 1, hip[1] + 1, 18, 13, C.navy, 3); // thigh
  c.line(18, 13, 17, 17, C.navy, 3); // shin
  c.set(18, 12, C.navyLight); // knee pad highlight
  c.rect(15, 16, 5, 3, C.boot); // boot on the peg
  c.set(16, 16, C.yellow);
  c.line(hip[0], hip[1], shoulder[0], shoulder[1], C.navy, 4); // torso
  c.line(hip[0] + 1, hip[1] - 2, shoulder[0] + 1, shoulder[1] - 2, C.navyLight); // back highlight
  c.line(hip[0], hip[1] + 2, shoulder[0] - 1, shoulder[1] + 2, C.navyDark); // belly shade
  c.hline(hip[0] - 1, hip[1] + 1, 3, C.yellow); // belt stripe
  c.line(shoulder[0], shoulder[1] + 1, 25, 9, C.navyLight, 2); // arm to the bar
  c.rect(25, 8, 3, 3, C.seat); // glove

  const head = [shoulder[0] + 3, shoulder[1] - 2];
  c.circle(head[0], head[1], 3, C.white);
  c.set(head[0] - 2, head[1] + 2, C.whiteShade);
  c.set(head[0] - 1, head[1] + 3, C.whiteShade);
  c.set(head[0], head[1] + 3, C.whiteShade);
  c.polygon(
    [
      [head[0] + 1, head[1] - 1],
      [head[0] + 4, head[1]],
      [head[0] + 4, head[1] + 2],
      [head[0] + 1, head[1] + 2],
    ],
    C.visorDark,
  ); // visor
  c.set(head[0] + 2, head[1], C.visor);
  c.set(head[0] + 3, head[1], C.visor);
  c.line(head[0] - 1, head[1] - 3, head[0] + 4, head[1] - 2, C.yellow, 2); // helmet peak
  c.hline(head[0] - 2, head[1] - 1, 3, C.yellow); // helmet stripe

  return c.outlined(C.outline);
}

/** Rider thrown off the bike (crash frames). */
export function riderRagdoll(frame = 0) {
  const c = new Canvas(18, 18);
  const poses = [
    {
      head: [12, 4],
      torso: [
        [8, 9],
        [12, 5],
      ],
      legs: [
        [8, 9],
        [4, 14],
      ],
      arm: [
        [11, 6],
        [15, 9],
      ],
    },
    {
      head: [12, 12],
      torso: [
        [8, 9],
        [11, 11],
      ],
      legs: [
        [8, 9],
        [3, 6],
      ],
      arm: [
        [10, 10],
        [14, 6],
      ],
    },
    {
      head: [5, 12],
      torso: [
        [9, 8],
        [6, 11],
      ],
      legs: [
        [9, 8],
        [14, 4],
      ],
      arm: [
        [7, 10],
        [3, 6],
      ],
    },
    {
      head: [4, 5],
      torso: [
        [9, 9],
        [5, 6],
      ],
      legs: [
        [9, 9],
        [14, 13],
      ],
      arm: [
        [6, 7],
        [2, 11],
      ],
    },
  ];
  const p = poses[frame % poses.length];
  c.line(p.legs[0][0], p.legs[0][1], p.legs[1][0], p.legs[1][1], C.navy, 3);
  c.rect(p.legs[1][0] - 1, p.legs[1][1] - 1, 3, 3, C.boot);
  c.line(p.torso[0][0], p.torso[0][1], p.torso[1][0], p.torso[1][1], C.navy, 4);
  c.line(p.arm[0][0], p.arm[0][1], p.arm[1][0], p.arm[1][1], C.navyLight, 2);
  c.circle(p.head[0], p.head[1], 3, C.white);
  c.set(p.head[0] + 1, p.head[1], C.visor);
  c.set(p.head[0], p.head[1] - 3, C.yellow);
  return c.outlined(C.outline);
}
