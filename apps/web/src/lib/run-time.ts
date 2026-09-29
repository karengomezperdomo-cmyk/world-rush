import { TICK_SECONDS } from '@worldrush/game-core';

/**
 * Run times, formatted the way the design board shows them: `00:23` with a smaller `.481` after it.
 *
 * The clock is the simulation's tick count, never a wall clock. That is the whole point of the fixed-step
 * design — the same replay re-simulated on the server produces the same tick count and therefore the same
 * time, which is what makes a submitted time checkable rather than merely reported.
 */

export interface RunTimeParts {
  /** `mm:ss`, zero-padded. */
  readonly clock: string;
  /** `.mmm`, including the leading dot. */
  readonly millis: string;
}

export function runTimeParts(ticks: number): RunTimeParts {
  const totalMilliseconds = Math.max(0, Math.round(ticks * TICK_SECONDS * 1000));
  const minutes = Math.floor(totalMilliseconds / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return {
    clock: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    millis: `.${String(milliseconds).padStart(3, '0')}`,
  };
}

/** `00:23.481`, for places that are not styling the milliseconds separately. */
export function formatRunTime(ticks: number): string {
  const parts = runTimeParts(ticks);
  return `${parts.clock}${parts.millis}`;
}

/**
 * A difference between two runs, as `−1.482` or `+0.900`. Uses a real minus sign (U+2212) rather than a
 * hyphen, matching the mocks — at the label sizes used here a hyphen reads as a dash in the middle of a word.
 */
export function formatDelta(ticks: number): string {
  const seconds = ticks * TICK_SECONDS;
  const sign = seconds < 0 ? '−' : '+';
  return `${sign}${Math.abs(seconds).toFixed(3)}`;
}
