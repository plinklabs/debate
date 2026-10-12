import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '../model/locale';
import { I18nContext, type I18n } from './context';
import { DICTIONARIES, describeIssue, translator } from './dictionary';
import { formatDuration, formatNumber } from './format';
import { browserLanguages, startLocale, storeLocale } from './language';

const browserStorage = () => window.localStorage;

interface Props {
  readonly children: ReactNode;
  /** Start in this language instead of the remembered or the browser's one (for tests). */
  readonly initialLocale?: Locale;
}

/**
 * Gives the components below it the UI language (`useI18n`), and keeps
 * `<html lang>` and the page title in that language.
 */
export function I18nProvider({ children, initialLocale }: Props) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? startLocale(browserStorage, browserLanguages()),
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(browserStorage, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = DICTIONARIES[locale]['app.title'];
  }, [locale]);

  const i18n = useMemo<I18n>(() => {
    const dictionary = DICTIONARIES[locale];
    return {
      locale,
      setLocale,
      t: translator(dictionary),
      formatNumber: (value, options) => formatNumber(locale, value, options),
      formatDuration: (seconds, style) => formatDuration(locale, seconds, style),
      describeIssue: (issue) => describeIssue(dictionary, issue),
    };
  }, [locale, setLocale]);

  return <I18nContext value={i18n}>{children}</I18nContext>;
}
