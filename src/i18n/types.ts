// The shapes the dictionaries share. English (en.ts) is the reference: its
// keys and parameter types make up `Dictionary`, and the Dutch dictionary must
// have exactly those keys.

import type { StepType } from '../model/config';
import type { ConfigIssue, ConfigIssueCode } from '../model/validate';

/**
 * A message is a plain string, or a function of its parameters when it has
 * any. A function says how numbers, plurals and word order go in its own
 * language.
 */
export type Message = string | ((params: never) => string);

export type IssueOf<C extends ConfigIssueCode> = Extract<ConfigIssue, { readonly code: C }>;

/**
 * One message for each problem `parseConfig` can report (src/model/validate.ts),
 * given the issue itself for its numbers. Where the problem is (`issue.path`)
 * is up to the screen that shows it.
 */
export type IssueMessages = {
  readonly [C in ConfigIssueCode as `issue.${C}`]: (issue: IssueOf<C>) => string;
};

/** The name of each kind of step, shown where a step has no label of its own. */
export type StepTypeNames = { readonly [T in StepType as `stepType.${T}`]: string };
