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

  // Shared by several screens.
  'action.cancel': 'Cancel',
  'action.remove': 'Remove',

  // The setup screen: three areas, shown one at a time as tabs.
  'setup.eyebrow': '// Setup',
  'setup.lede':
    'Topics, teams, timed turns and an audience vote, for running a debate in class. Nothing leaves your browser.',
  'setup.areas': 'Parts of the setup',
  'setup.tab.topics': 'Topics',
  'setup.tab.format': 'Format',
  'setup.tab.debates': 'Debates and teams',

  // Topics: the statements to debate.
  'topics.intro':
    'The statements the class debates, one per topic. Several debates can use the same topic.',
  'topics.label': ({ number }: { number: number }) => `Topic ${n(number)}`,
  'topics.moveUp': ({ number }: { number: number }) => `Move topic ${n(number)} up`,
  'topics.moveDown': ({ number }: { number: number }) => `Move topic ${n(number)} down`,
  'topics.remove': ({ number }: { number: number }) => `Remove topic ${n(number)}`,
  'topics.inUse': ({ count }: { count: number }) =>
    count === 1 ? 'Used by 1 debate.' : `Used by ${n(count)} debates.`,
  'topics.new': 'New topic',
  'topics.add': 'Add topic',

  // The format: sides, team size and steps.
  'format.intro':
    'The sides, the size of the teams and the steps of a debate. Every debate in this setup follows it.',
  'format.total': 'Total time',
  'format.stepCount': 'Steps',
  'format.locked': ({ count }: { count: number }) =>
    `${count === 1 ? 'One debate already has results' : `${n(count)} debates already have results`}. A change to the format changes how those read: a step you remove drops out of them, and a new duration changes the time that was planned.`,
  'format.unlock': 'Change the format anyway',
  'format.preset': 'Preset',
  'format.usePreset': 'Use this preset',
  'format.usePreset.question':
    'This replaces the sides, the team size and every step. The topics stay.',
  'format.usePreset.confirm': 'Replace the format',
  'format.sides': 'Sides',
  'format.side.pro': 'For the topic',
  'format.side.con': 'Against the topic',
  'format.teamSize': 'Students per team',
  'format.teamSize.min': 'At least',
  'format.teamSize.max': 'At most',
  'format.steps': 'Steps',
  'format.step': ({ number }: { number: number }) => `Step ${n(number)}`,
  'format.step.type': 'Kind',
  'format.step.label': 'Title',
  'format.step.side': 'Side',
  'format.step.seconds': 'Seconds',
  'format.step.secondsPerTeam': 'Seconds per team',
  'format.step.vote': 'The audience votes. No timer.',
  'format.step.moveUp': ({ number }: { number: number }) => `Move step ${n(number)} up`,
  'format.step.moveDown': ({ number }: { number: number }) => `Move step ${n(number)} down`,
  'format.step.remove': ({ number }: { number: number }) => `Remove step ${n(number)}`,
  'format.addStep': 'Add step',

  // Debates: a topic with a team on each side.
  'debates.intro':
    'A debate is one topic with a team on each side. It can start once both teams are complete.',
  'debates.topic': 'Topic',
  'debates.add': 'Add debate',
  'debates.none': 'No debates yet. Choose a topic and add one.',
  'debates.label': ({ number }: { number: number }) => `Debate ${n(number)}`,
  'debates.topicGone': 'This topic is no longer in the setup.',
  'debates.name': ({ number }: { number: number }) => `Name ${n(number)}`,
  'debates.nameOptional': ({ number }: { number: number }) => `Name ${n(number)} (optional)`,
  'debates.team.complete': 'Complete',
  'debates.team.tooFew': ({ min }: { min: number }) =>
    min === 1 ? 'Needs a name' : `Needs at least ${n(min)} names`,
  'debates.team.tooMany': ({ max }: { max: number }) =>
    max === 1 ? 'One name at most' : `At most ${n(max)} names`,
  'debates.status.ready': 'Ready',
  'debates.status.incomplete': 'Teams incomplete',
  'debates.status.started': 'Started',
  'debates.status.done': 'Finished',
  'debates.start': 'Start',
  'debates.continue': 'Continue',
  'debates.open': 'Open',
  'debates.remove': ({ number }: { number: number }) => `Remove debate ${n(number)}`,
  'debates.remove.question': 'Remove this debate, with its names and results?',
  'debates.remove.confirm': 'Remove debate',

  // The debate screen, a placeholder until #6.
  'debate.pending':
    'The debate screen is still being built. It will show the steps, a large timer and the vote.',
  'debate.back': 'Back to the setup',

  ...stepTypes,
  ...issues,
} satisfies Readonly<Record<string, Message>>;

/** Every UI string, by key. Each language has exactly these keys. */
export type Dictionary = { readonly [K in keyof typeof en]: (typeof en)[K] };

export type MessageKey = keyof Dictionary;
