import { createContext, useContext } from 'react';
import type { Locale } from '../model/locale';
import type { ConfigIssue } from '../model/validate';
import type { Translate } from './dictionary';
import type { DurationStyle } from './format';

/** What `useI18n` gives a component: the language, a way to change it, and text in it. */
export interface I18n {
  readonly locale: Locale;
  /** Switch the UI language and remember it in this browser. */
  readonly setLocale: (locale: Locale) => void;
  readonly t: Translate;
  /** `formatNumber` (format.ts) in the current language. */
  readonly formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** `formatDuration` (format.ts) in the current language. */
  readonly formatDuration: (seconds: number, style?: DurationStyle) => string;
  /** A problem with a setup, from `parseConfig`, as one sentence. */
  readonly describeIssue: (issue: ConfigIssue) => string;
}

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (i18n === null) throw new Error('useI18n needs an <I18nProvider> above it.');
  return i18n;
}
