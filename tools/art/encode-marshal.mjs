import { createRequire } from 'node:module';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Re-encodes the checkpoint marshal's HD frames as WebP.
 *
 * She is 46 frames of 160x264 RGBA — 1.77 MB of PNG, which was **94% of everything the game downloads**
 * (the rest of `public/art` is 230 KB all together) and on its own more than the 1.5 MB budget in
 * `docs/phase-0/02-architecture-proposal.md` §14. At WebP q95 the same 46 frames are 433 KB.
 *
 * ## Why not just ship smaller frames
 *
 * The obvious fix — she is drawn at about 0.63x, so store her smaller — is wrong here, and measuring said
 * so. The renderer scales her body to match the 46-art-pixel marshal she replaced, which works out at ~167
 * CSS pixels tall, and PixiJS renders at `window.devicePixelRatio`. On a 3x phone that is ~503 device
 * pixels from a 264-pixel source: she is already being scaled UP by nearly 2x. Shrinking the source would
 * cost real quality on exactly the devices this game is for.
 *
 * ## Why q95 and not lossless
 *
 * Measured, then looked at:
 *
 * | encoding            | size    |
 * | ------------------- | ------- |
 * | PNG (what was there)| 1769 KB |
 * | WebP lossless       | 1102 KB |
 * | WebP near-lossless  |  739 KB |
 * | **WebP q95**        | **433 KB** |
 * | WebP q85            |  271 KB |
 *
 * Alpha is encoded losslessly at every setting (`alphaQuality: 100`), so there is no halo around her at any
 * of them. At q95 the colour error on visible pixels is an RMSE of about 5/255. Compared side by side at
 * 3x zoom, and again at the 503-pixel size a 3x phone actually draws, q95 and the original are not
 * distinguishable — and trimming the transparent margins was tried and made the files *bigger*, because the
 * frames are nearly full and the per-frame sizes stop aligning.
 *
 * The PNGs stay in the repository as the masters. This script only produces what ships.
 *
 * Run with: `pnpm art:marshal`
 */

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const DIRECTORY = 'design/art/marshal-hd';
/** Alpha is always lossless: a soft edge on the alpha channel is a halo, and haloes are visible. */
const WEBP = { quality: 95, alphaQuality: 100, effort: 6 };

const frames = readdirSync(DIRECTORY)
  .filter((file) => file.endsWith('.png'))
  .sort();

let before = 0;
let after = 0;
for (const file of frames) {
  const source = join(DIRECTORY, file);
  const target = join(DIRECTORY, file.replace(/\.png$/, '.webp'));
  const encoded = await sharp(source).webp(WEBP).toBuffer();
  writeFileSync(target, encoded);
  before += statSync(source).size;
  after += encoded.length;
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
console.log(
  `encode-marshal: ${frames.length} frames, ${kb(before)} PNG -> ${kb(after)} WebP ` +
    `(${Math.round((1 - after / before) * 100)}% smaller)`,
);
