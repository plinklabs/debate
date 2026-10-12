// Numbers and durations as the UI language writes them. A running clock
// (`m:ss`) looks the same in every language: use `formatClock` from
// src/model/timer.ts for that.

import type { Locale } from '../model/locale';

const formatters = new Map<string, Intl.NumberFormat>();

// Building an Intl formatter is slow next to using one, and a debate screen
// formats on every tick, so each locale and set of options gets one.
function numberFormat(locale: Locale, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale} ${JSON.stringify(options)}`;
  let format = formatters.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale, options);
    formatters.set(key, format);
  }
  return format;
}

/**
 * A number as the language writes it: `1,234.5` in English, `1.234,5` in
 * Dutch. `options` are those of `Intl.NumberFormat`, e.g.
 * `{ maximumFractionDigits: 1, signDisplay: 'exceptZero' }` for a vote shift.
 */
export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return numberFormat(locale, options).format(value);
}

/** `short`: `1 min 30 sec`. `long`: `1 minute 30 seconds`, `1 minuut 30 seconden`. */
export type DurationStyle = 'short' | 'long';

/**
 * A length of time in words, in whole seconds: the minutes and the seconds,
 * leaving out a part that is zero (`2 min`, `45 sec`). Zero itself is `0 sec`.
 */
export function formatDuration(
  locale: Locale,
  totalSeconds: number,
  style: DurationStyle = 'short',
): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const unit = (name: 'minute' | 'second', value: number) =>
    formatNumber(locale, value, { style: 'unit', unit: name, unitDisplay: style });
  const parts: string[] = [];
  if (minutes > 0) parts.push(unit('minute', minutes));
  if (seconds > 0 || minutes === 0) parts.push(unit('second', seconds));
  return parts.join(' ');
}
