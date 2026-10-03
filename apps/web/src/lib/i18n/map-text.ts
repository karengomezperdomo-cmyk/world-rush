import type { MapEntry } from '@worldrush/game-core';
import type { MessageKey } from './messages';

/**
 * A map's name and tagline, in the language on screen.
 *
 * `game-core` holds them in English, as constants compiled into both the client and the server, and it must:
 * the level id travels inside every replay and the package bans anything environment-dependent. Display text
 * is the app's job, so the dictionaries carry `map.<slug>.name` and `map.<slug>.tagline`, keyed by the same
 * slug the level already has.
 *
 * The key is built from a string, so TypeScript cannot check it the way it checks a literal. The `maps.test`
 * fixture is what keeps the two in step: adding a map without its text makes the translation fall back to its
 * key, which is loud and searchable rather than silently blank.
 */
export function mapNameKey(map: MapEntry): MessageKey {
  return `map.${map.level.id}.name` as MessageKey;
}

export function mapTaglineKey(map: MapEntry): MessageKey {
  return `map.${map.level.id}.tagline` as MessageKey;
}

/** `MON`…`SUN` and `MONDAY`…`SUNDAY`, from the day a map runs on. */
export function dayKey(day: MapEntry['day']): MessageKey {
  return `day.${day.toLowerCase()}` as MessageKey;
}

export function dayNameKey(day: MapEntry['day']): MessageKey {
  return `dayName.${day.toLowerCase()}` as MessageKey;
}
