/**
 * Formats a validated run duration (integer milliseconds) as MM:SS.mmm, e.g. 34821 -> "00:34.821".
 * Times are integers everywhere in the system; floats are never used for durations.
 */
export function formatDurationMs(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0) {
    throw new RangeError(`duration must be a non-negative integer of milliseconds, got ${ms}`);
  }
  const millis = ms % 1000;
  const totalSeconds = (ms - millis) / 1000;
  const seconds = totalSeconds % 60;
  const minutes = (totalSeconds - seconds) / 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
