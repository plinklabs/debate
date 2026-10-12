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

/** With its sign, `+3` or `-1.5`, and no sign for 0. */
const signed = (value: number, digits = 0) =>
  formatNumber('en', value, { maximumFractionDigits: digits, signDisplay: 'exceptZero' });

/** 1 or −1 as shown with `digits` decimals: the singular. */
const isOne = (value: number, digits = 0) =>
  Math.abs(Math.round(value * 10 ** digits) / 10 ** digits) === 1;

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
  'issue.invalid-link': () =>
    'This link is damaged or incomplete. Copy the whole link again, or ask for a new one.',
  'issue.too-large': () => 'This is too large to be a setup.',
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
  'setup.tab.share': 'Share',

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

  // Share: the setup (topics and format) as a link or a file.
  'share.intro':
    'Share this setup with a colleague, keep it for next year, or put it on a course page. A link or a file holds the topics and the format, and nothing else: names, timings, votes and scores stay in this browser.',
  'share.link': 'As a link',
  'share.link.label': 'Link to this setup',
  'share.link.hint': 'Whoever opens it sees the setup first, and then chooses whether to use it.',
  'share.link.making': 'Making the link…',
  'share.link.copy': 'Copy link',
  'share.link.copied': 'Link copied.',
  'share.link.copyFailed':
    'This browser does not let the app copy. The link is selected: copy it with Ctrl+C, or Cmd+C on a Mac.',
  'share.file': 'As a file',
  'share.file.intro':
    'A .json file to keep or to send on. Open one to see what is in it before you use it.',
  'share.file.download': 'Download file',
  'share.file.open': 'Open a file',
  'share.file.name': 'debate-setup.json',

  // A shared setup, from a link or a file, shown before it is used.
  'preview.eyebrow': '// Shared setup',
  'preview.reading': 'Reading the setup…',
  'preview.title': 'Use this setup?',
  'preview.fromLink': 'This setup comes from a link. Nothing changes until you choose to use it.',
  'preview.fromFile': ({ name }: { name: string }) =>
    `This setup comes from the file “${name}”. Nothing changes until you choose to use it.`,
  'preview.teamSize': ({ min, max }: { min: number; max: number }) =>
    min === max ? n(min) : `${n(min)} to ${n(max)}`,
  'preview.perTeam': ({ duration }: { duration: string }) => `${duration} per team`,
  'preview.impact': ({ debates, results }: { debates: number; results: number }) =>
    debates === 1
      ? `There is one debate in this browser${results > 0 ? ', and it already has results' : ''}. It stays, but follows this setup from now on:`
      : `There are ${n(debates)} debates in this browser${results === 0 ? '' : results === 1 ? ', and one already has results' : `, and ${n(results)} already have results`}. They stay, but follow this setup from now on:`,
  'preview.impact.topic': ({ number, topic }: { number: number; topic: string }) =>
    `Debate ${n(number)} will be about “${topic}”`,
  'preview.impact.topicGone': ({ number }: { number: number }) =>
    `Debate ${n(number)} loses its topic: this setup does not have it.`,
  'preview.impact.format':
    'The format changes: a step this format does not have drops out of the results, and a new duration changes the time that was planned.',
  'preview.use': 'Use this setup',
  'preview.invalid.link': 'This link cannot be used',
  'preview.invalid.file': 'This file cannot be used',
  'preview.invalid.intro': 'It does not hold a setup that this app can read.',
  'preview.invalid.more': ({ count }: { count: number }) =>
    count === 1 ? 'And one more problem.' : `And ${n(count)} more problems.`,
  'preview.place.version': 'Version',
  'preview.close': 'Continue to the app',

  // The debate screen, on the projector: the steps, a large clock, who has
  // the floor, and the audience vote.
  'debate.back': 'Back to the setup',
  'debate.sound': 'Sound',
  'debate.sound.on': 'on',
  'debate.sound.off': 'off',
  'debate.steps': 'Steps',
  'debate.stepName': ({
    number,
    name,
    side,
  }: {
    number: number;
    name: string;
    side: string | null;
  }) => `Step ${n(number)}: ${name}${side === null ? '' : ` (${side})`}`,
  'debate.stepOf': ({ number, total }: { number: number; total: number }) =>
    `Step ${n(number)} of ${n(total)}`,
  'debate.who.both': 'Both teams',
  'debate.who.audience': 'The audience',
  'debate.floor': ({ name }: { name: string }) => `${name} has the floor`,
  'debate.tapSpeaker': 'Tap the student who speaks.',
  'debate.tapFreeRound': 'Tap a name: that team’s clock runs.',
  'debate.consult': 'Both teams prepare.',
  'debate.clock': 'Time',
  'debate.of': ({ time }: { time: string }) => `of ${time}`,
  'debate.paused': 'Paused',
  'debate.overtime': 'Overtime',
  'debate.timeUp': 'Time is up.',
  'debate.speakers': 'Spoke this turn',
  'debate.removeSpeaker': ({ name }: { name: string }) => `Remove ${name} from the speakers`,
  'debate.turns': ({ count }: { count: number }) => (count === 1 ? '1 turn' : `${n(count)} turns`),
  'debate.fewerTurns': ({ name }: { name: string }) => `One turn fewer for ${name}`,
  'debate.vote.prompt': 'Who agrees with the topic? Count the hands.',
  'debate.vote.count': ({ side }: { side: string }) => `Votes ${side}`,
  'debate.vote.fewer': ({ side }: { side: string }) => `One vote fewer for ${side}`,
  'debate.vote.more': ({ side }: { side: string }) => `One vote more for ${side}`,
  'debate.vote.before': 'Before',
  'debate.vote.after': 'After',
  'debate.shift': ({ points, side }: { points: number; side: string }) =>
    `Shift towards ${side}: ${signed(points, 1)} ${isOne(points, 1) ? 'percentage point' : 'percentage points'}`,
  'debate.shift.votes': ({ count }: { count: number }) =>
    `${signed(count)} ${isOne(count) ? 'vote' : 'votes'}`,
  'debate.shift.none': 'No shift yet: each vote needs at least one hand.',
  'debate.start': 'Start',
  'debate.pause': 'Pause',
  'debate.previous': 'Previous step',
  'debate.next': 'Next step',
  'debate.finish': 'Finish debate',
  'debate.keys': 'Space: start or pause · ← →: previous or next step',
  'debate.clear': 'Clear step',
  'debate.clear.question': 'Clear the time, the speakers or the votes of this step?',
  'debate.clear.confirm': 'Clear',

  ...stepTypes,
  ...issues,
} satisfies Readonly<Record<string, Message>>;

/** Every UI string, by key. Each language has exactly these keys. */
export type Dictionary = { readonly [K in keyof typeof en]: (typeof en)[K] };

export type MessageKey = keyof Dictionary;
