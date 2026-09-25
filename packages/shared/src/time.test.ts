import { describe, expect, it } from 'vitest';
import { formatDurationMs } from './time';

describe('formatDurationMs', () => {
  it.each([
    [0, '00:00.000'],
    [1, '00:00.001'],
    [28421, '00:28.421'],
    [34821, '00:34.821'],
    [59999, '00:59.999'],
    [60000, '01:00.000'],
    [61002, '01:01.002'],
    [3_600_000, '60:00.000'],
  ])('formats %i ms as %s', (ms, expected) => {
    expect(formatDurationMs(ms)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid input %s', (ms) => {
    expect(() => formatDurationMs(ms)).toThrow(RangeError);
  });
});
