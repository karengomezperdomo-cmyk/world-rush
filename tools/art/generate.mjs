#!/usr/bin/env node
/**
 * Generates the provisional art (decision C1) into design/art/. Deterministic: run it again and you get the
 * same files. Usage: node tools/art/generate.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AVATAR_COUNT, avatar } from './avatars.mjs';
import { bikeSprite, riderRagdoll } from './bike.mjs';
import { gameplayFrame, heroScene } from './canyon.mjs';
import { dustFrame, explosionFrame } from './fx.mjs';
import { logo } from './logo.mjs';
import { MAPS } from './thumbs.mjs';

const out = (path) => fileURLToPath(new URL(`../../design/art/${path}`, import.meta.url));
const manifest = {};

function emit(path, canvas) {
  canvas.save(out(path));
  manifest[path] = { width: canvas.w, height: canvas.h };
}

emit('bike/ride.png', bikeSprite({ lean: 0 }));
emit('bike/lean-back.png', bikeSprite({ lean: -1, spin: 60 }));
emit('bike/lean-forward.png', bikeSprite({ lean: 1, spin: 100 }));
for (let f = 0; f < 4; f++) emit(`bike/ragdoll-${f}.png`, riderRagdoll(f));
for (let f = 0; f < 6; f++) emit(`fx/explosion-${f}.png`, explosionFrame(f));
for (let f = 0; f < 4; f++) emit(`fx/dust-${f}.png`, dustFrame(f));

emit('scenes/hero-sunset-canyon.png', heroScene());
emit('scenes/gameplay-canyon.png', gameplayFrame({ groundAt: 0.62 }));
emit('scenes/gameplay-canyon-crash.png', gameplayFrame({ crash: true, groundAt: 0.62 }));
emit('scenes/gameplay-canyon-window.png', gameplayFrame({ height: 146 }));
emit('logo/rush7.png', logo());
for (let i = 0; i < AVATAR_COUNT; i++) emit(`avatars/a${i}.png`, avatar(i));
for (const map of MAPS) emit(`thumbs/map-${map.n}-${map.slug}.png`, map.thumb());

const maps = MAPS.map((map) => ({
  n: map.n,
  slug: map.slug,
  day: map.day,
  name: map.name,
  accent: map.accent,
  difficulty: map.difficulty,
  tagline: map.tagline,
  thumbnail: `thumbs/map-${map.n}-${map.slug}.png`,
}));
writeFileSync(
  out('manifest.json'),
  `${JSON.stringify({ artPixelInCssPixels: 2, files: manifest, maps }, null, 2)}\n`,
);
console.log(`design/art: ${Object.keys(manifest).length} images written`);
