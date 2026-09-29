import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  millisecondsUntilNextRace,
  raceDayOfWeek,
  todaysMap,
  weekRangeLabel,
  weekSchedule,
} from './schedule';

/** 2026-09-28 was a Monday. Every case below is anchored to that week so the expectations are readable. */
const MONDAY = new Date('2026-09-28T09:00:00Z');
const SUNDAY = new Date('2026-10-04T09:00:00Z');

describe('the daily rotation', () => {
  it('counts Monday as day 1 and Sunday as day 7', () => {
    // Sunday is 0 in JavaScript, which would otherwise put map 7 at the start of the week.
    expect(raceDayOfWeek(MONDAY)).toBe(1);
    expect(raceDayOfWeek(new Date('2026-10-03T23:59:00Z'))).toBe(6);
    expect(raceDayOfWeek(SUNDAY)).toBe(7);
  });

  it('opens map 1 on Monday and map 7 on Sunday', () => {
    expect(todaysMap(MONDAY).name).toBe('Sunset Canyon');
    expect(todaysMap(SUNDAY).name).toBe('Orbit Circuit');
    expect(todaysMap(new Date('2026-09-30T12:00:00Z')).number).toBe(3);
  });

  it('changes map exactly at the cut-over, not before', () => {
    expect(todaysMap(new Date('2026-09-28T23:59:59Z')).number).toBe(1);
    expect(todaysMap(new Date('2026-09-29T00:00:00Z')).number).toBe(2);
  });

  it('closes the days already raced and locks the ones still to come', () => {
    const week = weekSchedule(new Date('2026-09-30T12:00:00Z')); // Wednesday
    expect(week).toHaveLength(7);
    expect(week.map((day) => day.status)).toEqual([
      'past',
      'past',
      'today',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
  });

  it('locks nothing on the last day of the week', () => {
    expect(weekSchedule(SUNDAY).filter((day) => day.status === 'locked')).toHaveLength(0);
  });
});

describe('the countdown to the next race', () => {
  it('measures the time left until the cut-over', () => {
    const oneHourBefore = new Date('2026-09-28T23:00:00Z');
    expect(millisecondsUntilNextRace(oneHourBefore)).toBe(60 * 60 * 1000);
  });

  it('rolls over to tomorrow rather than returning zero at the cut-over itself', () => {
    expect(millisecondsUntilNextRace(new Date('2026-09-28T00:00:00Z'))).toBe(24 * 60 * 60 * 1000);
  });

  it('formats as a padded clock and never counts below zero', () => {
    expect(formatCountdown(12 * 3600_000 + 47 * 60_000 + 32_000)).toBe('12:47:32');
    expect(formatCountdown(5_000)).toBe('00:00:05');
    expect(formatCountdown(-1_000)).toBe('00:00:00');
  });
});

describe('the week header', () => {
  it('spans Monday to Sunday whichever day it is asked on', () => {
    expect(weekRangeLabel(MONDAY)).toBe('SEP 28 – OCT 4');
    expect(weekRangeLabel(SUNDAY)).toBe('SEP 28 – OCT 4');
  });
});
