/**
 * Injectable clock. Business code never calls `new Date()` directly, so time-dependent rules
 * (daily lock, weekly rollover, timezone edge cases) can be tested deterministically.
 *
 * In production the authoritative clock is the DATABASE clock (`now()`); this abstraction covers
 * application-side decisions and tests.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export interface ManualClock extends Clock {
  set(at: Date | string): void;
  advance(ms: number): void;
}

export function createManualClock(start: Date | string): ManualClock {
  let current = new Date(start).getTime();
  if (Number.isNaN(current)) throw new RangeError(`invalid start time: ${String(start)}`);
  return {
    now: () => new Date(current),
    set(at) {
      const next = new Date(at).getTime();
      if (Number.isNaN(next)) throw new RangeError(`invalid time: ${String(at)}`);
      current = next;
    },
    advance(ms) {
      current += ms;
    },
  };
}
