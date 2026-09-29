import { TICK_SECONDS } from '@worldrush/game-core';
import { describe, expect, it } from 'vitest';
import { formatDelta, formatRunTime, runTimeParts } from './run-time';

const ticksFor = (seconds: number) => Math.round(seconds / TICK_SECONDS);

describe('run times', () => {
  it('splits the clock from the milliseconds, the way the HUD renders them', () => {
    const parts = runTimeParts(ticksFor(23.5));
    expect(parts.clock).toBe('00:23');
    expect(parts.millis).toBe('.500');
  });

  it('pads minutes, seconds and milliseconds', () => {
    expect(formatRunTime(0)).toBe('00:00.000');
    expect(formatRunTime(ticksFor(5.004))).toBe('00:05.000'); // 5.004 s is not a whole tick; 60 Hz quantises it
    expect(formatRunTime(ticksFor(61))).toBe('01:01.000');
  });

  it('rolls into minutes rather than counting past 59 seconds', () => {
    expect(formatRunTime(ticksFor(125.25))).toBe('02:05.250');
  });

  it('never renders a negative clock', () => {
    expect(formatRunTime(-100)).toBe('00:00.000');
  });
});

describe('deltas between runs', () => {
  it('marks an improvement with a minus and a loss with a plus', () => {
    expect(formatDelta(-ticksFor(1.5))).toBe('−1.500');
    expect(formatDelta(ticksFor(0.9))).toBe('+0.900');
  });

  it('uses a true minus sign, not a hyphen', () => {
    expect(formatDelta(-ticksFor(1))).not.toContain('-');
  });
});
