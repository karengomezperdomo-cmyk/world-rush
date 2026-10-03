'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { MESSAGES, type MessageKey } from './messages';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locale';

/**
 * The language the screens are rendered in.
 *
 * The server resolves a locale from `Accept-Language` and passes it in, so the first paint is already in the
 * right language — no flash of English, and no round trip. A player who picks a language in Settings
 * overrides that, and the override lives in this browser (`localStorage`), because it is a preference about
 * this device rather than something the account carries.
 *
 * `t` returns the key itself if a message is missing. That cannot happen while the dictionaries typecheck,
 * which is the point: it is a visible, searchable failure instead of a blank space.
 */

const STORAGE_KEY = 'rush7:locale';

interface Translator {
  readonly locale: Locale;
  /** True when the locale came from the phone rather than from a choice in Settings. */
  readonly automatic: boolean;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  /** Picks the `.one` or `.other` form of a key by count, and fills `{count}`. */
  plural: (count: number, base: string, values?: Record<string, string | number>) => string;
  /** `null` hands the choice back to the phone. */
  setLocale: (locale: Locale | null) => void;
}

const TranslatorContext = createContext<Translator | null>(null);

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    // Private-mode browsers throw on access. A missing preference is not an error.
    return null;
  }
}

function fill(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

export function TranslationProvider({
  serverLocale,
  children,
}: {
  serverLocale: Locale;
  children: ReactNode;
}) {
  // Starts at the server's answer so the markup matches on hydration; a stored choice is applied after.
  const [chosen, setChosen] = useState<Locale | null>(null);
  useEffect(() => {
    setChosen(readStoredLocale());
  }, []);

  const locale = chosen ?? serverLocale;

  const setLocale = useCallback((next: Locale | null) => {
    setChosen(next);
    try {
      if (next === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The screen still changes language for this visit; only remembering it failed.
    }
  }, []);

  const value = useMemo<Translator>(() => {
    const messages = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
    const t = (key: MessageKey, values?: Record<string, string | number>) =>
      fill(messages[key] ?? key, values);
    return {
      locale,
      automatic: chosen === null,
      t,
      plural: (count, base, values) =>
        t(`${base}.${count === 1 ? 'one' : 'other'}` as MessageKey, { count, ...values }),
      setLocale,
    };
  }, [chosen, locale, setLocale]);

  // `lang` has to follow the language actually on screen: it is what a screen reader announces in, and what
  // the browser hyphenates by. The server sets it too, for the first paint.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <TranslatorContext.Provider value={value}>{children}</TranslatorContext.Provider>;
}

export function useTranslation(): Translator {
  const value = useContext(TranslatorContext);
  if (!value) throw new Error('useTranslation must be used inside <TranslationProvider>');
  return value;
}
