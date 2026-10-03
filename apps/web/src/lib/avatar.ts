/**
 * Which of the eight bundled avatars a player gets.
 *
 * These are decoration, not identity: World profile pictures are not fetched anywhere yet, and the `users`
 * table's `avatarUrl` is never written. The pick is a hash of the name rather than a random choice, because
 * the only property that makes a stand-in avatar useful instead of noisy is that the same player keeps the
 * same face — between rows, between screens and between page loads.
 *
 * When real profile pictures arrive, this becomes the fallback for players who have none.
 */
export const AVATAR_COUNT = 8;

export function avatarFor(name: string | null | undefined): string {
  const key = name ?? '';
  // FNV-ish: cheap, stable, and nothing here is security-sensitive.
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return `/art/avatars/a${hash % AVATAR_COUNT}.png`;
}
