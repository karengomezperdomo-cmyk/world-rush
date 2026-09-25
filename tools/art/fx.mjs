import { Canvas, mix, rng } from './lib/pixel.mjs';

/**
 * Explosion animation frame (0..5), 32x32. Fireball grows, cools from white-yellow to red, then turns into smoke.
 * Purely procedural and deterministic.
 */
export function explosionFrame(frame) {
  const S = 32;
  const c = new Canvas(S, S);
  const r = rng(1000 + frame);
  const cx = 16;
  const cy = 17;
  const radius = [4, 8, 12, 14, 14, 12][frame] ?? 12;
  const smoke = frame >= 4;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.05);
      const wobble =
        radius +
        Math.sin(x * 1.7 + frame) * 1.5 +
        Math.cos(y * 1.3 - frame) * 1.5 +
        (r() - 0.5) * 2;
      if (d > wobble) continue;
      const t = d / wobble; // 0 centre .. 1 edge
      let colour;
      if (smoke) colour = t < 0.6 ? '#5a4a6a' : '#3a2d4a';
      else if (t < 0.25) colour = '#fff6cc';
      else if (t < 0.5) colour = '#ffd24a';
      else if (t < 0.75) colour = '#ff8a2e';
      else colour = '#d9342b';
      if (smoke && r() < 0.18) colour = mix(colour, '#ffb070', 0.5);
      c.set(x, y, colour);
    }
  // debris sparks flying outwards
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + frame * 0.4;
    const d = radius + 1 + r() * 3;
    c.set(cx + Math.cos(a) * d, cy + Math.sin(a) * d, frame >= 4 ? '#7a6a8a' : '#ffe08f');
  }
  return c.outlined('#150b1e');
}

/** Small dust puff (0..3), 12x8. */
export function dustFrame(frame) {
  const c = new Canvas(14, 10);
  const r = rng(2000 + frame);
  const size = [2, 3, 4, 4][frame] ?? 4;
  for (let i = 0; i < 4; i++) {
    const cx = 3 + i * 2 + r.int(-1, 1);
    const cy = 6 - Math.round(frame * 0.7) + r.int(-1, 1);
    c.circle(cx, cy, Math.max(1, size - (i % 2)), frame >= 3 ? '#e0a37a66' : '#f5c090aa');
  }
  return c;
}
