/**
 * The player's best time so far, kept in this browser.
 *
 * This is **not** the leaderboard and is not a verified time. Phase 7 adds the server-side record — replay
 * submission, re-simulation and ranking — and this is what the finish screen can honestly show until then:
 * a personal best held on one device, labelled as such. Presenting a locally stored number as though the
 * server had confirmed it would be a lie the player has no way to detect.
 *
 * Scoped per map AND per day, because a map opens once a day and the mocks' phrase is "your best TODAY".
 *
 * Every access is wrapped: `localStorage` throws outright in a private window on some browsers, and World
 * App's WebView is not a browser this code controls. A best time is a nicety; it must never take the finish
 * screen down with it.
 */

const KEY_PREFIX = 'rush7:best';

/** The UTC calendar day, matching how `lib/schedule` decides which map is open. */
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function keyFor(mapId: string, day: string): string {
  return `${KEY_PREFIX}:${mapId}:${day}`;
}

/** The stored best for this map today, in ticks, or `null` when there is none (or storage is unavailable). */
export function readBestTicks(mapId: string, day: string): number | null {
  try {
    const raw = window.localStorage.getItem(keyFor(mapId, day));
    if (raw === null) return null;
    const ticks = Number.parseInt(raw, 10);
    return Number.isFinite(ticks) && ticks > 0 ? ticks : null;
  } catch {
    return null;
  }
}

/**
 * Records a finished run if it beats the stored best. Returns what the finish screen needs to know:
 * whether this run is a new best, and by how many ticks it beat the old one.
 */
export function recordRun(
  mapId: string,
  day: string,
  ticks: number,
): { readonly isBest: boolean; readonly previousBestTicks: number | null } {
  const previousBestTicks = readBestTicks(mapId, day);
  const isBest = previousBestTicks === null || ticks < previousBestTicks;
  if (isBest) {
    try {
      window.localStorage.setItem(keyFor(mapId, day), String(ticks));
    } catch {
      // Storage refused. The run still happened and the screen still shows its time.
    }
  }
  return { isBest, previousBestTicks };
}
