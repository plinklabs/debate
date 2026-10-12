// The UI in English and Dutch. Components call `useI18n()` for `t`, the
// formatters and the language switch; strings live in en.ts and nl.ts.

export { useI18n, type I18n } from './context';
export {
  DICTIONARIES,
  describeIssue,
  translator,
  type Dictionary,
  type MessageKey,
  type Translate,
} from './dictionary';
export { formatDuration, formatNumber, type DurationStyle } from './format';
export { I18nProvider } from './I18nProvider';
