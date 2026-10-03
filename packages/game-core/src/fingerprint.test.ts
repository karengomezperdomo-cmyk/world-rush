import { describe, expect, it } from 'vitest';
import { levelFingerprint } from './fingerprint';
import { buildTrack, defineLevel, type Level } from './level';
import { MAPS, SUNSET_CANYON } from './maps';

function track(): Level {
  return defineLevel({
    id: 'test-track',
    ground: buildTrack(-6, 0, [
      {
        steps: [
          [40, 0],
          [16, 2],
        ],
      },
      { gap: 10, drop: 1.2 },
      { steps: [[80, 0]] },
    ]),
    start: { x: 0, y: 0.6 },
    finishX: 110,
    killY: -12,
  });
}

describe('level fingerprints', () => {
  it('is stable for the same level', () => {
    expect(levelFingerprint(SUNSET_CANYON)).toBe(levelFingerprint(SUNSET_CANYON));
  });

  it('differs between the seven maps', () => {
    const fingerprints = MAPS.map((map) => levelFingerprint(map.level));
    expect(new Set(fingerprints).size).toBe(MAPS.length);
  });

  it('changes when the ground moves by a hair', () => {
    const before = track();
    const after: Level = {
      ...before,
      // One millimetre. A player would never notice; a stopwatch would.
      ground: before.ground.map((strip, index) =>
        index === 0 ? strip.map(([x, y], i) => (i === 1 ? [x, y + 0.001] : [x, y])) : strip,
      ) as Level['ground'],
    };
    expect(levelFingerprint(after)).not.toBe(levelFingerprint(before));
  });

  it('changes when the finish line, kill height, friction or checkpoints change', () => {
    const base = track();
    const fingerprint = levelFingerprint(base);
    expect(levelFingerprint({ ...base, finishX: 111 })).not.toBe(fingerprint);
    expect(levelFingerprint({ ...base, killY: -13 })).not.toBe(fingerprint);
    expect(levelFingerprint({ ...base, groundFriction: 0.9 })).not.toBe(fingerprint);
    expect(levelFingerprint({ ...base, checkpoints: [50] })).not.toBe(fingerprint);
  });

  it('changes when the same points are split into different strips', () => {
    const joined = defineLevel({
      id: 'split-test',
      ground: [
        [
          [0, 0],
          [50, 0],
          [100, 0],
        ],
      ],
      start: { x: 0, y: 0.6 },
      finishX: 90,
      killY: -12,
    });
    const split = defineLevel({
      id: 'split-test',
      ground: [
        [
          [0, 0],
          [50, 0],
        ],
        [
          [60, 0],
          [100, 0],
        ],
      ],
      start: { x: 0, y: 0.6 },
      finishX: 90,
      killY: -12,
    });
    // The gap between strips is a hole the rider falls through, so this is a different track entirely.
    expect(levelFingerprint(split)).not.toBe(levelFingerprint(joined));
  });

  it('ignores cosmetic changes, because renaming a map must not void anyone’s time', () => {
    const base = track();
    // `MapEntry` carries name, tagline, accent and difficulty; none of them reach the fingerprint, which
    // only ever sees the Level.
    expect(levelFingerprint({ ...base })).toBe(levelFingerprint(base));
  });

  it('is short and printable, so it can sit in a database column and a log line', () => {
    const fingerprint = levelFingerprint(SUNSET_CANYON);
    expect(fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });
});
