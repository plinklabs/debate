// Which UI language to use: the one the user picked before, else the first of
// the browser's languages that the app has, else English. The choice is kept
// under its own key, apart from the debate state (src/model/storage.ts).

import { LOCALES, type Locale } from '../model/locale';

export const LANGUAGE_STORAGE_KEY = 'plinklabs:debate:language';

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

/** The UI language for a language tag such as `nl-BE`, or `null` when there is none. */
export function matchLocale(tag: string): Locale | null {
  const language = tag.trim().toLowerCase().split(/[-_]/)[0];
  return LOCALES.find((locale) => locale === language) ?? null;
}

/** The first of `preferred` (most wanted first) that the app has, else English. */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const locale = matchLocale(tag);
    if (locale !== null) return locale;
  }
  return DEFAULT_LOCALE;
}

/** The browser's languages, most wanted first. */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

/** The part of the Web Storage API this needs; `window.localStorage` fits. */
export interface LanguageStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The language the user picked earlier, or `null`. `store` is a function
 * because merely reading `window.localStorage` throws when storage is blocked.
 */
export function readStoredLocale(store: () => LanguageStore): Locale | null {
  try {
    const value = store().getItem(LANGUAGE_STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/** Remember the user's pick. `false` when storage is blocked: the pick then lasts until a reload. */
export function storeLocale(store: () => LanguageStore, locale: Locale): boolean {
  try {
    store().setItem(LANGUAGE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function startLocale(store: () => LanguageStore, preferred: readonly string[]): Locale {
  return readStoredLocale(store) ?? detectLocale(preferred);
}
