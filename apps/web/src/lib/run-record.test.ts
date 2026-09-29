import { afterEach, describe, expect, it, vi } from 'vitest';
import { dayKey, readBestTicks, recordRun } from './run-record';

/** A stand-in for `window.localStorage`; the test environment is node, which has neither. */
function useStorage(store = new Map<string, string>()) {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
  return store;
}

/** Storage that refuses everything, the way a locked-down or private-mode browser does. */
function useHostileStorage() {
  vi.stubGlobal('window', {
    get localStorage(): never {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the personal best kept on this device', () => {
  it('has nothing to report before the first run', () => {
    useStorage();
    expect(readBestTicks('coral-coast', '2026-09-29')).toBeNull();
  });

  it('records a first run as a best, with nothing to compare against', () => {
    useStorage();
    const result = recordRun('coral-coast', '2026-09-29', 2400);
    expect(result.isBest).toBe(true);
    expect(result.previousBestTicks).toBeNull();
    expect(readBestTicks('coral-coast', '2026-09-29')).toBe(2400);
  });

  it('keeps the faster run and reports what it beat', () => {
    useStorage();
    recordRun('coral-coast', '2026-09-29', 2400);
    const better = recordRun('coral-coast', '2026-09-29', 2100);
    expect(better.isBest).toBe(true);
    expect(better.previousBestTicks).toBe(2400);
    expect(readBestTicks('coral-coast', '2026-09-29')).toBe(2100);
  });

  it('does not overwrite a best with a slower run', () => {
    useStorage();
    recordRun('coral-coast', '2026-09-29', 2100);
    const worse = recordRun('coral-coast', '2026-09-29', 2600);
    expect(worse.isBest).toBe(false);
    expect(worse.previousBestTicks).toBe(2100);
    expect(readBestTicks('coral-coast', '2026-09-29')).toBe(2100);
  });

  it('keeps each map and each day apart', () => {
    useStorage();
    recordRun('coral-coast', '2026-09-29', 2100);
    expect(readBestTicks('emerald-woods', '2026-09-29')).toBeNull();
    expect(readBestTicks('coral-coast', '2026-09-30')).toBeNull();
  });

  it('ignores corrupted stored values instead of showing a nonsense time', () => {
    const store = useStorage();
    store.set('rush7:best:coral-coast:2026-09-29', 'not a number');
    expect(readBestTicks('coral-coast', '2026-09-29')).toBeNull();
  });

  it('survives storage that throws, because a best time must never take the finish screen down', () => {
    useHostileStorage();
    expect(readBestTicks('coral-coast', '2026-09-29')).toBeNull();
    // Still reports the run as a best, so the screen renders; it just cannot remember it.
    expect(() => recordRun('coral-coast', '2026-09-29', 2100)).not.toThrow();
    expect(recordRun('coral-coast', '2026-09-29', 2100).isBest).toBe(true);
  });
});

describe('the day a run belongs to', () => {
  it('is the UTC calendar day, matching how the map rotation is decided', () => {
    expect(dayKey(new Date('2026-09-29T23:59:00Z'))).toBe('2026-09-29');
    expect(dayKey(new Date('2026-09-30T00:01:00Z'))).toBe('2026-09-30');
  });
});
