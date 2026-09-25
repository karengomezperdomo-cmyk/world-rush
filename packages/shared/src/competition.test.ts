import { describe, expect, it } from 'vitest';
import {
  canStartRun,
  competitionAcceptsScores,
  competitionPhase,
  tileState,
  type CompetitionWindow,
} from './competition';

// A Monday competition in UTC: opens 00:00, closes the next 00:00 (half-open window).
const monday: CompetitionWindow = {
  opensAt: new Date('2026-09-14T00:00:00.000Z'),
  closesAt: new Date('2026-09-15T00:00:00.000Z'),
  graceSeconds: 120,
};
const at = (iso: string) => new Date(iso);

describe('competitionPhase (half-open [opensAt, closesAt))', () => {
  it('is locked before opening, open at the opening instant, closed at the closing instant', () => {
    expect(competitionPhase(monday, at('2026-09-13T23:59:59.999Z'))).toBe('locked');
    expect(competitionPhase(monday, at('2026-09-14T00:00:00.000Z'))).toBe('open');
    expect(competitionPhase(monday, at('2026-09-14T23:59:59.999Z'))).toBe('open');
    expect(competitionPhase(monday, at('2026-09-15T00:00:00.000Z'))).toBe('closed');
  });

  it('does not let Monday be played on Tuesday', () => {
    expect(competitionPhase(monday, at('2026-09-15T10:00:00.000Z'))).toBe('closed');
    expect(canStartRun(monday, at('2026-09-15T10:00:00.000Z'))).toBe(false);
  });

  it('is independent of the local timezone of the runtime (instants are UTC)', () => {
    // 18:59:59.999 in Bogota (UTC-5) is 23:59:59.999Z -> still Monday's window.
    expect(competitionPhase(monday, at('2026-09-14T18:59:59.999-05:00'))).toBe('open');
    // 19:00:00 in Bogota (UTC-5) is exactly 00:00:00Z of Tuesday -> closed.
    expect(competitionPhase(monday, at('2026-09-14T19:00:00.000-05:00'))).toBe('closed');
  });
});

describe('competitionAcceptsScores (grace only for runs already in flight)', () => {
  it('accepts until closing + grace, then rejects', () => {
    expect(competitionAcceptsScores(monday, at('2026-09-14T12:00:00.000Z'))).toBe(true);
    expect(competitionAcceptsScores(monday, at('2026-09-15T00:01:59.999Z'))).toBe(true);
    expect(competitionAcceptsScores(monday, at('2026-09-15T00:02:00.000Z'))).toBe(false);
  });

  it('rejects before opening', () => {
    expect(competitionAcceptsScores(monday, at('2026-09-13T23:59:59.999Z'))).toBe(false);
  });

  it('a NEW run cannot start during the grace period', () => {
    expect(canStartRun(monday, at('2026-09-15T00:00:30.000Z'))).toBe(false);
    expect(competitionAcceptsScores(monday, at('2026-09-15T00:00:30.000Z'))).toBe(true);
  });

  it('defaults to no grace', () => {
    const strict = { opensAt: monday.opensAt, closesAt: monday.closesAt };
    expect(competitionAcceptsScores(strict, at('2026-09-15T00:00:00.000Z'))).toBe(false);
  });
});

describe('tileState (Home screen tiles)', () => {
  it('maps phase + player result to the four visual states', () => {
    expect(tileState('locked', false)).toBe('LOCKED');
    expect(tileState('open', false)).toBe('TODAY');
    expect(tileState('open', true)).toBe('TODAY');
    expect(tileState('closed', false)).toBe('CLOSED');
    expect(tileState('closed', true)).toBe('COMPLETED');
  });

  it('never shows LOCKED for a map that already ended', () => {
    expect(tileState('closed', false)).not.toBe('LOCKED');
  });
});
