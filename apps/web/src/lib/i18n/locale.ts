/**
 * Which language the app speaks.
 *
 * World's own guidelines are the source for two things here (docs.world.org, Mini Apps → App Guidelines,
 * read 2026-10-03): recognise the user's locale from the **`Accept-Language` header**, and localise, because
 * "many of our users are located around the world. Apps that are localised for each region will perform
 * significantly better." They name six priority languages — English, Spanish, Thai, Japanese, Korean,
 * Portuguese — and decision A6 ships the first two, with the machinery in place from day one so the rest are
 * a dictionary each rather than a rewrite.
 *
 * **No locale in the URL.** The documented Next.js approach puts the language in the path, which exists to
 * give search engines one page per language — and a Mini App is opened from inside World App and explicitly
 * not indexed (`robots: noindex` in the root layout). Routing would buy nothing and cost every link, so the
 * locale is resolved on the server from the header and carried down through a provider instead.
 */

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks a locale from an `Accept-Language` header.
 *
 * Quality values are honoured, because `es;q=0.9, en;q=0.95` means English — a header a player really can
 * send, and reading it left to right would answer Spanish. Region subtags are matched on their base language
 * (`es-419`, Latin American Spanish, is Spanish), which is the only sane reading for a game that has one
 * Spanish. Anything unparseable or unknown falls back to English rather than guessing.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;

  const candidates = header
    .split(',')
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(';');
      const quality = parameters
        .map((parameter) => /^\s*q=([0-9.]+)\s*$/.exec(parameter))
        .find((match) => match !== null);
      const parsed = quality ? Number(quality[1]) : 1;
      return {
        language: (tag ?? '').trim().toLowerCase().split('-')[0] ?? '',
        // A malformed q is treated as absent, i.e. the default weight of 1.
        quality: Number.isFinite(parsed) ? parsed : 1,
      };
    })
    .filter((candidate) => candidate.language.length > 0 && candidate.quality > 0)
    // Stable sort by descending quality: equal weights keep the order the client sent them in.
    .sort((a, b) => b.quality - a.quality);

  for (const candidate of candidates) {
    if (candidate.language === '*') return DEFAULT_LOCALE;
    if (isLocale(candidate.language)) return candidate.language;
  }
  return DEFAULT_LOCALE;
}
