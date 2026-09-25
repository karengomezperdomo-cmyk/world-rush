import { Canvas, drawText, measureText } from './lib/pixel.mjs';

/**
 * RUSH 7 wordmark (provisional). Italic chunky letters with a two-step extrusion, a hot-gradient "7" and a
 * blue/white checkered flag, following the mock's logo but WITHOUT any World mark (naming rules, decision A1/C2).
 */
export function logo() {
  const c = new Canvas(100, 36);
  const shear = 0.2;
  const y = 16;
  const x = 6;
  const face = (row) => (row < 4 ? '#ffffff' : '#c8d8ff');
  drawText(c, 'RUSH', x + 2, y + 2, '#101a55', { scale: 2, shear });
  drawText(c, 'RUSH', x + 1, y + 1, '#3f5cc0', { scale: 2, shear });
  drawText(c, 'RUSH', x, y, face, { scale: 2, shear });

  const x7 = x + measureText('RUSH', { scale: 2 }) + 5;
  const y7 = y + 14 - 28;
  const hot = ['#fff0a0', '#ffd23e', '#ffb02e', '#ff8a2a', '#ff6a2a', '#ff4a2a', '#e0301f'];
  drawText(c, '7', x7 + 2, y7 + 2, '#7a1f1a', { scale: 4, shear });
  drawText(c, '7', x7 + 1, y7 + 1, '#c2331e', { scale: 4, shear });
  drawText(c, '7', x7, y7, (row) => hot[row], { scale: 4, shear });

  // checkered flag mark (blue and white, like the mock's logo)
  const fx = x7 + 27;
  const fy = 0;
  for (let gy = 0; gy < 4; gy++)
    for (let gx = 0; gx < 4; gx++) {
      const wave = Math.round(Math.sin(gx * 0.9) * 1);
      c.rect(
        fx + gx * 3 + gy,
        fy + gy * 3 + wave,
        3,
        3,
        (gx + gy) % 2 === 0 ? '#f4f8ff' : '#6f8fe8',
      );
    }
  // speed streaks
  c.hline(0, y + 4, 5, '#35d6ff');
  c.hline(1, y + 8, 4, '#35d6ff88');
  c.hline(0, y + 12, 6, '#35d6ff');
  return c;
}
