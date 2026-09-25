#!/usr/bin/env node
/**
 * Copies the Box2D "compat" WASM build into `apps/web/public/box2d/`, where the browser loads it from a URL
 * instead of through the bundler (see `packages/game-client/src/physics-loader.ts` for why).
 *
 * Runs from `apps/web`'s `predev` / `prebuild`, so a fresh clone or a `box2d3-wasm` upgrade cannot leave a
 * stale copy behind. The destination is generated, not authored — it is git-ignored.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = ['Box2D.compat.mjs', 'Box2D.compat.wasm'];

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(repoRoot, 'apps', 'web', 'public', 'box2d');

// pnpm keeps this symlink for any declared dependency, which makes it a stabler handle than either the
// version-stamped `.pnpm` directory or module resolution — `box2d3-wasm`'s exports map declares no "require"
// condition and does not expose `./package.json`, so `require.resolve` on it fails outright.
const source = join(
  repoRoot,
  'packages',
  'game-core',
  'node_modules',
  'box2d3-wasm',
  'build',
  'dist',
  'es',
  'compat',
);

await mkdir(destination, { recursive: true });
for (const file of FILES) {
  await copyFile(join(source, file), join(destination, file));
}
console.log(`copy-box2d: copied ${FILES.length} files to apps/web/public/box2d/`);
