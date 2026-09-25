/**
 * Tiny dependency-free pixel-art toolkit used to generate the provisional art (decision C1).
 * Everything is deterministic: the same code always produces the same pixels.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- colours

const colourCache = new Map();

/** '#rgb' | '#rrggbb' | '#rrggbbaa' | [r,g,b] | [r,g,b,a]  ->  [r,g,b,a] */
export function rgba(input) {
  if (Array.isArray(input)) return input.length === 3 ? [input[0], input[1], input[2], 255] : input;
  const cached = colourCache.get(input);
  if (cached) return cached;
  let hex = input.startsWith('#') ? input.slice(1) : input;
  if (hex.length === 3) hex = [...hex].map((ch) => ch + ch).join('');
  const n = Number.parseInt(hex.slice(0, 6), 16);
  const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255;
  const value = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  colourCache.set(input, value);
  return value;
}

export function mix(a, b, t) {
  const [ar, ag, ab, aa] = rgba(a);
  const [br, bg, bb, ba] = rgba(b);
  return [
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
    Math.round(aa + (ba - aa) * t),
  ];
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

// ---------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function encodePng(width, height, data) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export class Canvas {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x, y) {
    if (!this.inside(x, y)) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  set(x, y, colour) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return this;
    const [r, g, b, a] = rgba(colour);
    const d = this.data;
    const i = (y * this.w + x) * 4;
    if (a === 255) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    } else if (a > 0) {
      const sa = a / 255;
      const da = d[i + 3] / 255;
      const oa = sa + da * (1 - sa);
      d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
      d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
      d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
      d[i + 3] = oa * 255;
    }
    return this;
  }

  isOpaque(x, y) {
    return this.inside(x, y) && this.data[(y * this.w + x) * 4 + 3] > 127;
  }

  fill(colour) {
    return this.rect(0, 0, this.w, this.h, colour);
  }

  rect(x, y, w, h, colour) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, colour);
    return this;
  }

  hline(x, y, w, colour) {
    return this.rect(x, y, w, 1, colour);
  }

  vline(x, y, h, colour) {
    return this.rect(x, y, 1, h, colour);
  }

  /** Bresenham line; `thick` > 1 stamps a square brush. */
  line(x0, y0, x1, y1, colour, thick = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const half = Math.floor((thick - 1) / 2);
    for (;;) {
      this.rect(x0 - half, y0 - half, thick, thick, colour);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  circle(cx, cy, r, colour) {
    const limit = r * r + r * 0.8;
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= limit) this.set(cx + x, cy + y, colour);
    return this;
  }

  ring(cx, cy, r, colour, thickness = 1) {
    const outer = r * r + r * 0.8;
    const ri = r - thickness;
    const inner = ri * ri + ri * 0.8;
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (d <= outer && d > inner) this.set(cx + x, cy + y, colour);
      }
    return this;
  }

  ellipse(cx, cy, rx, ry, colour) {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++)
        if ((x * x) / (rx * rx + rx * 0.5) + (y * y) / (ry * ry + ry * 0.5) <= 1)
          this.set(cx + x, cy + y, colour);
    return this;
  }

  /** Scanline polygon fill on pixel centres. `points` = [[x,y], ...] */
  polygon(points, colour) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const cy = y + 0.5;
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy))
          xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.ceil(xs[i] - 0.5); x < xs[i + 1] - 0.5 + 1e-9; x++)
          this.set(x, y, colour);
    }
    return this;
  }

  /** Vertical/horizontal gradient using ordered (Bayer 4x4) dithering between adjacent stops. */
  gradient(x, y, w, h, stops, { axis = 'v', dither = true } = {}) {
    const n = axis === 'v' ? h : w;
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0 : k / (n - 1);
      let a = stops[0];
      let b = stops[stops.length - 1];
      for (let s = 0; s < stops.length - 1; s++)
        if (t >= stops[s][0] && t <= stops[s + 1][0]) {
          a = stops[s];
          b = stops[s + 1];
          break;
        }
      const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      const span = axis === 'v' ? w : h;
      for (let m = 0; m < span; m++) {
        const px = axis === 'v' ? x + m : x + k;
        const py = axis === 'v' ? y + k : y + m;
        const threshold = (BAYER4[py & 3][px & 3] + 0.5) / 16;
        const pick = dither ? (f > threshold ? b[1] : a[1]) : mix(a[1], b[1], f);
        this.set(px, py, pick);
      }
    }
    return this;
  }

  blit(src, dx, dy, { flipX = false, flipY = false } = {}) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.data[i + 3] === 0) continue;
        const tx = flipX ? src.w - 1 - x : x;
        const ty = flipY ? src.h - 1 - y : y;
        this.set(dx + tx, dy + ty, [
          src.data[i],
          src.data[i + 1],
          src.data[i + 2],
          src.data[i + 3],
        ]);
      }
    return this;
  }

  clone() {
    const c = new Canvas(this.w, this.h);
    c.data.set(this.data);
    return c;
  }

  crop(x, y, w, h) {
    const c = new Canvas(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c.set(i, j, this.get(x + i, y + j));
    return c;
  }

  pad(n) {
    const c = new Canvas(this.w + n * 2, this.h + n * 2);
    c.blit(this, n, n);
    return c;
  }

  /** Nearest-neighbour upscale (exact pixels). */
  scale(n) {
    const c = new Canvas(this.w * n, this.h * n);
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        const i = (Math.floor(y / n) * this.w + Math.floor(x / n)) * 4;
        const j = (y * c.w + x) * 4;
        c.data[j] = this.data[i];
        c.data[j + 1] = this.data[i + 1];
        c.data[j + 2] = this.data[i + 2];
        c.data[j + 3] = this.data[i + 3];
      }
    return c;
  }

  /** New canvas (padded by 1px) with a 1px outline around every opaque shape. */
  outlined(colour, diagonals = false) {
    const p = this.pad(1);
    const out = p.clone();
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        if (p.isOpaque(x, y)) continue;
        const near =
          p.isOpaque(x - 1, y) ||
          p.isOpaque(x + 1, y) ||
          p.isOpaque(x, y - 1) ||
          p.isOpaque(x, y + 1);
        const diag =
          diagonals &&
          (p.isOpaque(x - 1, y - 1) ||
            p.isOpaque(x + 1, y - 1) ||
            p.isOpaque(x - 1, y + 1) ||
            p.isOpaque(x + 1, y + 1));
        if (near || diag) out.set(x, y, colour);
      }
    return out;
  }

  toPNG() {
    return encodePng(this.w, this.h, this.data);
  }

  save(path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, this.toPNG());
    return this;
  }
}

// ---------------------------------------------------------------- sprites from ASCII

/** rows: array of equal-length strings. palette: { char: colour }. '.' and ' ' are transparent. */
export function fromAscii(rows, palette) {
  const c = new Canvas(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.' && ch !== ' ') {
        const colour = palette[ch];
        if (!colour) throw new Error(`no palette entry for "${ch}"`);
        c.set(x, y, colour);
      }
    });
  });
  return c;
}

// ---------------------------------------------------------------- RotSprite-style rotation

/**
 * Rotates pixel art without the usual mush: upscale x4, rotate by inverse mapping (nearest), then reduce every
 * 4x4 block to its most common opaque colour (or transparent if mostly empty).
 */
export function rotateSprite(src, degrees) {
  const S = 4;
  const big = src.scale(S);
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ow = Math.ceil(Math.abs(src.w * cos) + Math.abs(src.h * sin)) + 1;
  const oh = Math.ceil(Math.abs(src.w * sin) + Math.abs(src.h * cos)) + 1;
  const out = new Canvas(ow, oh);
  const cx = (src.w * S) / 2;
  const cy = (src.h * S) / 2;
  const ocx = (ow * S) / 2;
  const ocy = (oh * S) / 2;
  for (let oy = 0; oy < oh; oy++)
    for (let ox = 0; ox < ow; ox++) {
      const votes = new Map();
      let opaque = 0;
      for (let j = 0; j < S; j++)
        for (let i = 0; i < S; i++) {
          const dx = ox * S + i + 0.5 - ocx;
          const dy = oy * S + j + 0.5 - ocy;
          const sx = Math.floor(dx * cos + dy * sin + cx);
          const sy = Math.floor(-dx * sin + dy * cos + cy);
          if (!big.isOpaque(sx, sy)) continue;
          opaque++;
          const [r, g, b, a] = big.get(sx, sy);
          const key = `${r},${g},${b},${a}`;
          votes.set(key, (votes.get(key) ?? 0) + 1);
        }
      if (opaque < (S * S) / 2) continue;
      let best = null;
      let bestVotes = 0;
      for (const [key, count] of votes) if (count > bestVotes) [best, bestVotes] = [key, count];
      out.set(ox, oy, best.split(',').map(Number));
    }
  return out;
}

// ---------------------------------------------------------------- 5x7 bitmap font

const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

/**
 * Draws `text` with the 5x7 bitmap font. Returns the width in pixels. `shear` slants letters (italic).
 * `colour` may be a function (glyphRow) => colour to paint vertical gradients.
 */
export function drawText(canvas, text, x, y, colour, { scale = 1, spacing = 1, shear = 0 } = {}) {
  let cursor = x;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch] ?? GLYPHS['?'] ?? GLYPHS[' '];
    const advance = ch === ' ' ? 3 : ch === '.' || ch === ':' || ch === '!' || ch === "'" ? 3 : 5;
    const left = ch === '.' || ch === ':' || ch === '!' || ch === "'" ? 2 : 0;
    glyph.forEach((row, gy) => {
      [...row].forEach((cell, gx) => {
        if (cell !== '#') return;
        const slant = Math.round((6 - gy) * shear * scale);
        const paint = typeof colour === 'function' ? colour(gy) : colour;
        canvas.rect(cursor + (gx - left) * scale + slant, y + gy * scale, scale, scale, paint);
      });
    });
    cursor += (advance + spacing) * scale;
  }
  return cursor - x;
}

export function measureText(text, { scale = 1, spacing = 1 } = {}) {
  let w = 0;
  for (const ch of text.toUpperCase()) {
    const narrow = ch === ' ' || ch === '.' || ch === ':' || ch === '!' || ch === "'";
    w += ((narrow ? 3 : 5) + spacing) * scale;
  }
  return w - spacing * scale;
}
