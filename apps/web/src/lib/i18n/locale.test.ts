import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, localeFromAcceptLanguage } from './locale';

/**
 * Header parsing is where localisation quietly goes wrong: the common bug is reading the list left to right
 * and ignoring the quality values, which hands a Spanish screen to someone who asked for English.
 */
describe('localeFromAcceptLanguage', () => {
  it('falls back to English when there is no header', () => {
    expect(localeFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
    expect(localeFromAcceptLanguage('')).toBe(DEFAULT_LOCALE);
  });

  it('reads a simple header', () => {
    expect(localeFromAcceptLanguage('es')).toBe('es');
    expect(localeFromAcceptLanguage('en')).toBe('en');
  });

  it('matches a region subtag on its base language', () => {
    // Latin American Spanish, Colombian Spanish, European Spanish: one Spanish here.
    expect(localeFromAcceptLanguage('es-419')).toBe('es');
    expect(localeFromAcceptLanguage('es-CO,es;q=0.9')).toBe('es');
    expect(localeFromAcceptLanguage('en-GB')).toBe('en');
  });

  it('honours quality values rather than the order they are written in', () => {
    expect(localeFromAcceptLanguage('es;q=0.9, en;q=0.95')).toBe('en');
    expect(localeFromAcceptLanguage('en;q=0.5, es;q=0.8')).toBe('es');
  });

  it('skips languages it does not have', () => {
    // Thai first, but nothing is translated into it yet, so the next best wins rather than English by force.
    expect(localeFromAcceptLanguage('th,es;q=0.8,en;q=0.5')).toBe('es');
    expect(localeFromAcceptLanguage('th,ja,ko')).toBe(DEFAULT_LOCALE);
  });

  it('treats a wildcard as no preference', () => {
    expect(localeFromAcceptLanguage('*')).toBe(DEFAULT_LOCALE);
  });

  it('survives a malformed header instead of throwing', () => {
    expect(localeFromAcceptLanguage(';;;')).toBe(DEFAULT_LOCALE);
    expect(localeFromAcceptLanguage('es;q=banana')).toBe('es');
  });

  it('knows which strings are locales', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('pt')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
