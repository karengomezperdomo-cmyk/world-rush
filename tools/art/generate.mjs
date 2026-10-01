#!/usr/bin/env node
/**
 * Generates the provisional art (decision C1) into design/art/. Deterministic: run it again and you get the
 * same files. Usage: node tools/art/generate.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AVATAR_COUNT, avatar } from './avatars.mjs';
import { bikeSprite, riderRagdoll } from './bike.mjs';
import { brakeDisc, fuelCan, leanIcon } from './controls.mjs';
import { gameplayFrame, heroScene } from './canyon.mjs';
import { dustFrame, explosionFrame } from './fx.mjs';
import { HERO_SCENES } from './heroes.mjs';
import { logo } from './logo.mjs';
import { marshal } from './marshal.mjs';
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

// Wheel-spin frames, so the bike reads as MOVING rather than sliding along on frozen wheels. The tread
// blocks repeat every 30 degrees alternating and the spokes every 60, so the wheel's visual period is 60:
// four frames across that one period cycle seamlessly. The unindexed sprites above stay for the mocks.
const SPIN_FRAMES = [0, 15, 30, 45];
for (const [pose, options] of [
  ['ride', { lean: 0 }],
  ['lean-back', { lean: -1 }],
  ['lean-forward', { lean: 1 }],
]) {
  SPIN_FRAMES.forEach((spin, frame) =>
    emit(`bike/${pose}-${frame}.png`, bikeSprite({ ...options, spin })),
  );
}
for (let f = 0; f < 6; f++) emit(`fx/explosion-${f}.png`, explosionFrame(f));
for (let f = 0; f < 4; f++) emit(`fx/dust-${f}.png`, dustFrame(f));

emit('scenes/hero-sunset-canyon.png', heroScene());
// Maps 2-7, at the same size as map 1's. Before these existed, Home enlarged a 46x28 thumbnail instead.
for (const [path, draw] of HERO_SCENES) emit(path, draw());
emit('scenes/gameplay-canyon.png', gameplayFrame({ groundAt: 0.62 }));
emit('scenes/gameplay-canyon-crash.png', gameplayFrame({ crash: true, groundAt: 0.62 }));
emit('scenes/gameplay-canyon-window.png', gameplayFrame({ height: 146 }));
// Control-pad icons: the thing each pad does, rather than a generic symbol.
emit('controls/gas.png', fuelCan());
emit('controls/brake.png', brakeDisc());
emit('controls/lean-back.png', leanIcon('back'));
emit('controls/lean-forward.png', leanIcon('forward'));
emit('logo/rush7.png', logo());
// The checkpoint marshal: arms down until the rider takes the checkpoint, then both arms up, waving.
emit('marshal/idle.png', marshal({ cheer: false }));
emit('marshal/cheer-0.png', marshal({ cheer: true, frame: 0 }));
emit('marshal/cheer-1.png', marshal({ cheer: true, frame: 1 }));
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
  hero: `scenes/hero-${map.slug}.png`,
}));
writeFileSync(
  out('manifest.json'),
  `${JSON.stringify({ artPixelInCssPixels: 2, files: manifest, maps }, null, 2)}\n`,
);
console.log(`design/art: ${Object.keys(manifest).length} images written`);
