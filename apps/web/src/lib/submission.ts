/**
 * Talking to the run endpoints from the browser.
 *
 * Submission is deliberately optional to the act of playing. A player who is signed out, offline, or whose
 * submission is refused still gets a complete game — they just do not get a ranked time, and the finish
 * screen says which of those happened instead of pretending.
 */

export interface StartedRun {
  readonly runId: string;
  readonly mapSlug: string;
  readonly mapNumber: number;
}

/** Why a run has no ranked time. Each maps to something the finish screen can say plainly. */
export type SubmissionFailure =
  | 'not-signed-in'
  | 'offline'
  | 'rejected'
  | 'did-not-finish'
  | 'duplicate'
  | 'window-closed';

export interface SubmittedTime {
  readonly durationMs: number;
  readonly isPersonalBest: boolean;
  readonly previousBestMs: number | null;
  readonly rank: number;
  readonly totalPlayers: number;
}

/** Opens a run. Returns null when there is no session or the server will not issue one. */
export async function startRun(): Promise<StartedRun | null> {
  try {
    const response = await fetch('/api/runs/start', { method: 'POST' });
    if (!response.ok) return null;
    return (await response.json()) as StartedRun;
  } catch {
    return null;
  }
}

export type SubmissionOutcome =
  | { ok: true; time: SubmittedTime }
  | { ok: false; reason: SubmissionFailure };

const FAILURE_BY_CODE: Record<string, SubmissionFailure> = {
  did_not_finish: 'did-not-finish',
  duplicate: 'duplicate',
  window_closed: 'window-closed',
};

/**
 * Posts the replay and returns the server's verdict.
 *
 * The body is the raw bytes — it is already a compact binary format, and base64 would inflate it by a third
 * to no purpose. The claimed duration rides in a header purely so the server can compare it against its own
 * answer; nothing the client says here is ever ranked.
 */
export async function submitReplay(
  runId: string,
  replay: Uint8Array,
  claimedDurationMs: number,
): Promise<SubmissionOutcome> {
  try {
    const response = await fetch(`/api/runs/${runId}/submit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-claimed-duration-ms': String(claimedDurationMs),
      },
      body: replay as BodyInit,
    });
    if (response.status === 401) return { ok: false, reason: 'not-signed-in' };
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { code?: string };
      return { ok: false, reason: FAILURE_BY_CODE[body.code ?? ''] ?? 'rejected' };
    }
    return { ok: true, time: (await response.json()) as SubmittedTime };
  } catch {
    // A network failure is not a rejection, and telling the player their run was refused would be wrong.
    return { ok: false, reason: 'offline' };
  }
}
