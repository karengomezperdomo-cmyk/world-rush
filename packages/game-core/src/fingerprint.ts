import type { Level } from './level';

/**
 * A short fingerprint of a level's playable content.
 *
 * Times are only comparable if they were set on the same track. Move one ramp and every record from before
 * the change is measuring a different race — so a competition stores the fingerprint of the level it ran on,
 * and a replay submitted against a level that no longer matches is rejected rather than silently ranked
 * beside times from the old layout.
 *
 * ## This is a change detector, not a cryptographic hash
 *
 * It is FNV-1a over the level's numbers. It will reliably notice an edit, which is the job. It is NOT
 * collision-resistant and nothing security-critical should rest on it: an attacker who could choose level
 * data could construct a collision. That does not matter here, because levels come from the application's
 * own compiled source and never from a player.
 *
 * A real SHA-256 would need `node:crypto` or WebCrypto, and this package is deliberately free of host
 * globals so that it behaves identically wherever it runs — which is the same reason the simulation is
 * trustworthy in the first place.
 *
 * Only PLAYABLE content is included. Nothing cosmetic: renaming a map or changing its accent colour does not
 * invalidate anyone's time, and should not.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Mixes one 32-bit value into the running hash. All arithmetic kept in 32 bits with `>>> 0`. */
function mix(hash: number, value: number): number {
  let next = hash;
  for (let shift = 0; shift < 32; shift += 8) {
    next = (next ^ ((value >>> shift) & 0xff)) >>> 0;
    next = Math.imul(next, FNV_PRIME) >>> 0;
  }
  return next;
}

/**
 * Folds a float into the hash through its exact bit pattern.
 *
 * Rounding the number to a few decimals first would make the fingerprint blind to tiny edits, and tiny edits
 * to geometry are exactly what changes a run's outcome.
 */
const floatView = new DataView(new ArrayBuffer(8));
function mixFloat(hash: number, value: number): number {
  floatView.setFloat64(0, value);
  return mix(mix(hash, floatView.getUint32(0)), floatView.getUint32(4));
}

function mixString(hash: number, value: string): number {
  let next = hash;
  for (let i = 0; i < value.length; i++) next = mix(next, value.charCodeAt(i));
  return next;
}

export function levelFingerprint(level: Level): string {
  let hash = FNV_OFFSET_BASIS;
  hash = mixString(hash, level.id);
  hash = mixFloat(hash, level.start.x);
  hash = mixFloat(hash, level.start.y);
  hash = mixFloat(hash, level.finishX);
  hash = mixFloat(hash, level.killY);
  hash = mixFloat(hash, level.groundFriction ?? 1);

  // Strip boundaries matter: the same points split into different strips is a different track, because the
  // gaps between strips are the holes.
  for (const strip of level.ground) {
    hash = mix(hash, strip.length);
    for (const [x, y] of strip) {
      hash = mixFloat(hash, x);
      hash = mixFloat(hash, y);
    }
  }
  for (const checkpoint of level.checkpoints) hash = mixFloat(hash, checkpoint);

  return hash.toString(16).padStart(8, '0');
}
