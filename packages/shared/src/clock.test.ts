import { describe, expect, it } from 'vitest';
import { createManualClock, systemClock } from './clock';

describe('clock', () => {
  it('manual clock is fully controlled by the test', () => {
    const clock = createManualClock('2026-09-14T23:59:59.000Z');
    expect(clock.now().toISOString()).toBe('2026-09-14T23:59:59.000Z');
    clock.advance(1000);
    expect(clock.now().toISOString()).toBe('2026-09-15T00:00:00.000Z');
    clock.set('2026-09-21T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  it('returns a fresh Date each time (no shared mutable state)', () => {
    const clock = createManualClock('2026-09-14T00:00:00.000Z');
    clock.now().setUTCFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });

  it('rejects invalid times', () => {
    expect(() => createManualClock('not a date')).toThrow(RangeError);
    expect(() => createManualClock('2026-09-14T00:00:00.000Z').set('nope')).toThrow(RangeError);
  });

  it('system clock returns a Date', () => {
    expect(systemClock.now()).toBeInstanceOf(Date);
  });
});
