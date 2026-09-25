/**
 * Competition time rules. These mirror, one to one, the SQL functions `competition_phase()` and
 * `competition_accepts_scores()` in docs/phase-0/schema-proposal.sql (validated on PostgreSQL 18):
 * the DATABASE decides in production, this module serves the UI, tests and app-side pre-checks.
 *
 * Windows are HALF-OPEN: [opensAt, closesAt).
 */
export type CompetitionPhase = 'locked' | 'open' | 'closed';

export interface CompetitionWindow {
  opensAt: Date;
  closesAt: Date;
  /** Extra seconds for runs that STARTED before closesAt. Default 0. */
  graceSeconds?: number;
}

export function competitionPhase(window: CompetitionWindow, at: Date): CompetitionPhase {
  const t = at.getTime();
  if (t < window.opensAt.getTime()) return 'locked';
  if (t < window.closesAt.getTime()) return 'open';
  return 'closed';
}

/** A NEW run can only start while the competition is open. */
export function canStartRun(window: CompetitionWindow, at: Date): boolean {
  return competitionPhase(window, at) === 'open';
}

/** Scores are accepted from opening until closing + grace (in-flight runs may finish). */
export function competitionAcceptsScores(window: CompetitionWindow, at: Date): boolean {
  const t = at.getTime();
  const graceMs = (window.graceSeconds ?? 0) * 1000;
  return t >= window.opensAt.getTime() && t < window.closesAt.getTime() + graceMs;
}

/** Visual state of a day tile on the Home screen (decision C2 keeps the mock's tiles). */
export type TileState = 'LOCKED' | 'TODAY' | 'CLOSED' | 'COMPLETED';

/**
 * LOCKED    = not available yet
 * TODAY     = playable now
 * CLOSED    = ended and the player has no time
 * COMPLETED = ended and the player has a valid time
 */
export function tileState(phase: CompetitionPhase, playerHasTime: boolean): TileState {
  switch (phase) {
    case 'locked':
      return 'LOCKED';
    case 'open':
      return 'TODAY';
    case 'closed':
      return playerHasTime ? 'COMPLETED' : 'CLOSED';
  }
}
