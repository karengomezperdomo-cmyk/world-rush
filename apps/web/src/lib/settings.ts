/**
 * Player settings, held in this browser.
 *
 * Every setting here controls something that actually exists. The design mock (`design/screens/settings.html`)
 * also shows rows for a control-layout A/B switch, "reduce flashing" and "anonymous usage stats"; those are
 * deliberately absent, because scheme B is not built, nothing flashes yet, and there is no analytics to opt
 * out of. A switch that changes nothing is worse than no switch — and a *privacy* switch that changes nothing
 * is worse still, because it invites the player to believe they have turned something off.
 *
 * Storage is best-effort. `localStorage` throws outright in some private-mode browsers, so every read and
 * write is guarded and the defaults stand in when it is unavailable.
 */

export interface Settings {
  /** Short UI and gameplay sounds: engine, checkpoint, crash, finish. */
  readonly soundEffects: boolean;
  /** The background track. Separate from effects, because people mute music far more often. */
  readonly music: boolean;
  /** Haptic feedback on crash and finish, through MiniKit. Only ever fires inside World App. */
  readonly vibration: boolean;
  /** Mirrors the control pads: gas and brake move to the left thumb. */
  readonly swapSides: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  soundEffects: true,
  music: true,
  vibration: true,
  swapSides: false,
};

const STORAGE_KEY = 'rush7:settings';

/** Fired on `window` after any change, so screens already mounted pick it up. */
export const SETTINGS_CHANGED_EVENT = 'rush7:settings-changed';

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function readSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS;
    const stored = parsed as Record<string, unknown>;
    // Field by field, so a corrupted or half-written value falls back to its default rather than
    // poisoning the whole object — and so settings added later do not break an older stored blob.
    return {
      soundEffects: isBoolean(stored.soundEffects)
        ? stored.soundEffects
        : DEFAULT_SETTINGS.soundEffects,
      music: isBoolean(stored.music) ? stored.music : DEFAULT_SETTINGS.music,
      vibration: isBoolean(stored.vibration) ? stored.vibration : DEFAULT_SETTINGS.vibration,
      swapSides: isBoolean(stored.swapSides) ? stored.swapSides : DEFAULT_SETTINGS.swapSides,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Writes one setting and announces the change. Returns the full settings as they now stand. */
export function writeSetting<K extends keyof Settings>(key: K, value: Settings[K]): Settings {
  const next: Settings = { ...readSettings(), [key]: value };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage refused. The change still applies for this session through the event below.
  }
  try {
    window.dispatchEvent(new CustomEvent<Settings>(SETTINGS_CHANGED_EVENT, { detail: next }));
  } catch {
    // Pre-DOM or a stripped environment; nothing is listening either way.
  }
  return next;
}
