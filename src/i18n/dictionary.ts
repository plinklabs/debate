// The dictionaries by language, and the `t` function that reads one.

import type { Locale } from '../model/locale';
import type { ConfigIssue } from '../model/validate';
import { en, type Dictionary, type MessageKey } from './en';
import { nl } from './nl';

export type { Dictionary, MessageKey } from './en';

export const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = { en, nl };

/** The parameters a message takes: none for a plain string. */
export type MessageParams<K extends MessageKey> = Dictionary[K] extends (params: infer P) => string
  ? [params: P]
  : [];

/** `t('app.name')`, or `t(key, params)` for a message that takes parameters. */
export type Translate = <K extends MessageKey>(key: K, ...params: MessageParams<K>) => string;

export function translator(dictionary: Dictionary): Translate {
  return (key, ...params) => {
    const message: Dictionary[MessageKey] = dictionary[key];
    if (typeof message === 'string') return message;
    // `params` was checked against this key's message at the call site.
    return (message as (params: unknown) => string)(params[0]);
  };
}

/** A problem with a setup (from `parseConfig`) as one sentence. */
export function describeIssue(dictionary: Dictionary, issue: ConfigIssue): string {
  // Each code's message takes that code's issue; the union cannot express it.
  const message = dictionary[`issue.${issue.code}`] as (issue: ConfigIssue) => string;
  return message(issue);
}
