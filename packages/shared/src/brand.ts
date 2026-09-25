/**
 * Public brand, kept in ONE place so a rename is a one-line change.
 *
 * PROVISIONAL: decision A1 = "RUSH 7" (docs/DECISIONS.md). No trademark clearance has been done yet.
 * World's app-review naming rules forbid the word "World" in the app name, so the previous working
 * title stays only as the internal codename (repository, package scope).
 */
export const BRAND = {
  name: 'RUSH 7',
  codename: 'world-rush',
  provisional: true,
} as const;
