import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, readSettings, writeSetting } from './settings';

function useStorage(store = new Map<string, string>()) {
  const events: unknown[] = [];
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    dispatchEvent: (event: unknown) => void events.push(event),
  });
  vi.stubGlobal('CustomEvent', class {
    constructor(
      public type: string,
      public init?: { detail?: unknown },
    ) {}
  });
  return { store, events };
}

function useHostileStorage() {
  vi.stubGlobal('window', {
    get localStorage(): never {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
    dispatchEvent: () => undefined,
  });
  vi.stubGlobal('CustomEvent', class {
    constructor(
      public type: string,
      public init?: { detail?: unknown },
    ) {}
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('player settings', () => {
  it('starts with sound and haptics on, and the pads unswapped', () => {
    useStorage();
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.soundEffects).toBe(true);
    expect(DEFAULT_SETTINGS.swapSides).toBe(false);
  });

  it('remembers a change and leaves the others alone', () => {
    useStorage();
    const next = writeSetting('music', false);
    expect(next.music).toBe(false);
    expect(next.soundEffects).toBe(true);
    expect(readSettings().music).toBe(false);
    expect(readSettings().vibration).toBe(true);
  });

  it('announces every change, so a screen already on display updates', () => {
    const { events } = useStorage();
    writeSetting('vibration', false);
    expect(events).toHaveLength(1);
    expect((events[0] as { type: string }).type).toBe('rush7:settings-changed');
    expect((events[0] as { init?: { detail?: unknown } }).init?.detail).toMatchObject({
      vibration: false,
    });
  });

  it('falls back per field, so one corrupted value does not reset everything', () => {
    const { store } = useStorage();
    store.set('rush7:settings', JSON.stringify({ music: false, soundEffects: 'yes please' }));
    const settings = readSettings();
    expect(settings.music).toBe(false); // the good value survives
    expect(settings.soundEffects).toBe(true); // the bad one falls back
  });

  it('ignores stored rubbish entirely rather than throwing', () => {
    const { store } = useStorage();
    store.set('rush7:settings', 'not json at all');
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('still works when storage throws, which it does in some private windows', () => {
    useHostileStorage();
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => writeSetting('music', false)).not.toThrow();
    // The change is reported back to the caller even though it could not be persisted.
    expect(writeSetting('music', false).music).toBe(false);
  });
});
