// English: the reference dictionary. A key added here must be added to nl.ts
// too, or the build fails.
//
// What teachers type (topics, side labels, step labels) is not in here: that
// is content, shown as it was typed.

import { LIMITS, type StepType } from '../model/config';
import type { ValueType } from '../model/validate';
import { formatNumber } from './format';
import type { IssueMessages, Message, StepTypeNames } from './types';

const n = (value: number) => formatNumber('en', value);

const stepTypes: StepTypeNames = {
  'stepType.speech': 'Speech',
  'stepType.consultation': 'Consultation',
  'stepType.free-round': 'Free round',
  'stepType.vote-before': 'Vote before',
  'stepType.vote-after': 'Vote after',
};

const stepType = (type: StepType) => stepTypes[`stepType.${type}`];

const valueTypes: Readonly<Record<ValueType, string>> = {
  object: 'a group of fields',
  array: 'a list',
  string: 'text',
  integer: 'a whole number',
};

const issues: IssueMessages = {
  'issue.invalid-json': () => 'This is not a setup: the text cannot be read.',
  'issue.newer-version': ({ found, supported }) =>
    `This setup was made with a newer version of the app (version ${n(found)}; this one reads up to version ${n(supported)}). Reload the page to get the latest version.`,
  'issue.invalid-version': () => 'This setup has no valid version number.',
  'issue.missing-field': () => 'This field is missing.',
  'issue.wrong-type': ({ expected }) => `This should be ${valueTypes[expected]}.`,
  'issue.unknown-step-type': ({ stepType }) => `There is no kind of step called “${stepType}”.`,
  'issue.unknown-side': ({ side }) => `There is no side called “${side}”.`,
  'issue.out-of-range': ({ value, min, max }) =>
    `${n(value)} is not between ${n(min)} and ${n(max)}.`,
  'issue.empty': () => 'This cannot be empty.',
  'issue.too-long': ({ length, max }) => `Too long: ${n(length)} characters, at most ${n(max)}.`,
  'issue.too-few': ({ count, min }) => `Too few: ${n(count)}, at least ${n(min)}.`,
  'issue.too-many': ({ count, max }) => `Too many: ${n(count)}, at most ${n(max)}.`,
  'issue.invalid-id': () =>
    `An id is 1 to ${n(LIMITS.idLength)} letters, digits or dashes, and does not start with a dash.`,
  'issue.duplicate-id': ({ id }) => `The id “${id}” is used more than once.`,
  'issue.duplicate-step-type': ({ stepType: type }) =>
    `There can be only one “${stepType(type)}” step.`,
  'issue.team-size-order': ({ min, max }) =>
    `The smallest team size (${n(min)}) is larger than the largest (${n(max)}).`,
  'issue.vote-order': () =>
    `The “${stepType('vote-after')}” step comes before the “${stepType('vote-before')}” step.`,
};

export const en = {
  // The name of the app, also the page title.
  'app.title': 'Debate — by Plink Labs',
  'app.name': 'Debate',
  'app.endorsement': '— by Plink Labs',

  // The language switch. Each dictionary names its own language, the same in
  // every UI language: a reader looks for their language by its own name.
  'language.label': 'Language',
  'language.name': 'English',
  'language.code': 'EN',

  // The placeholder page, until the setup screen (#4) replaces it.
  'placeholder.status': '// Work in progress',
  'placeholder.lede':
    'Topics, teams, timed turns and an audience vote, for running a debate in class. Nothing leaves your browser.',

  ...stepTypes,
  ...issues,
} satisfies Readonly<Record<string, Message>>;

/** Every UI string, by key. Each language has exactly these keys. */
export type Dictionary = { readonly [K in keyof typeof en]: (typeof en)[K] };

export type MessageKey = keyof Dictionary;
