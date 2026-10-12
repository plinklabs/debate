// The shareable half of the model: a debate *format* (side labels, team size,
// the ordered steps) and the *topics* to debate. This is what goes into a link
// or a .json file (#5), so it holds nothing about a particular class: no
// names, timings, votes or scores. Those live in session.ts, which imports from
// here and never the other way round; boundaries.test.ts checks that no
// shareable module can reach the session modules.
//
// Configs from outside (a link, a file) go through `parseConfig` in
// validate.ts before they are used.

export const CONFIG_VERSION = 1;

/**
 * The two sides. `pro` defends the topic and `con` opposes it. The audience
 * vote asks who agrees with the topic, so a vote for the topic counts for
 * `pro`. What a side is called on screen is up to the format (`Format.sides`).
 */
export type Side = 'pro' | 'con';

export const SIDES: readonly Side[] = ['pro', 'con'];

interface StepBase {
  /** Stable key for this step's results in a session; survives reordering. */
  readonly id: string;
  /** Shown on screen. Teacher content, so not translated; may be empty. */
  readonly label: string;
}

/** One side speaks; one timer. */
export interface SpeechStep extends StepBase {
  readonly type: 'speech';
  readonly side: Side;
  readonly seconds: number;
}

/** Both teams prepare at the same time; one timer. */
export interface ConsultationStep extends StepBase {
  readonly type: 'consultation';
  readonly seconds: number;
}

/** A chess clock: one clock per team, and `seconds` is the time on *each* clock. */
export interface FreeRoundStep extends StepBase {
  readonly type: 'free-round';
  readonly seconds: number;
}

/** The audience votes for or against the topic before the debate. No timer. */
export interface VoteBeforeStep extends StepBase {
  readonly type: 'vote-before';
}

/** The audience votes again afterwards; the shift between the two counts. No timer. */
export interface VoteAfterStep extends StepBase {
  readonly type: 'vote-after';
}

/**
 * One step of a format, discriminated on `type`. A new kind of step is a new
 * member here with its own fields; the switches over `type` in the model then
 * fail to compile until they handle it.
 */
export type Step = SpeechStep | ConsultationStep | FreeRoundStep | VoteBeforeStep | VoteAfterStep;

export type StepType = Step['type'];

export type TimedStep = SpeechStep | ConsultationStep | FreeRoundStep;

export type VoteStep = VoteBeforeStep | VoteAfterStep;

// A record, so the compiler checks that the list names every type, and no other.
const STEP_TYPE_SET: Readonly<Record<StepType, true>> = {
  speech: true,
  consultation: true,
  'free-round': true,
  'vote-before': true,
  'vote-after': true,
};

export const STEP_TYPES = Object.keys(STEP_TYPE_SET) as readonly StepType[];

export function isStepType(value: string): value is StepType {
  return Object.hasOwn(STEP_TYPE_SET, value);
}

export interface TeamSize {
  readonly min: number;
  readonly max: number;
}

export interface Format {
  /** What each side is called on screen (VOOR/TEGEN, Pro/Contra, …). */
  readonly sides: Readonly<Record<Side, string>>;
  readonly teamSize: TeamSize;
  readonly steps: readonly Step[];
}

/** A statement to debate. */
export interface Topic {
  readonly id: string;
  readonly text: string;
}

export interface DebateConfig {
  readonly version: typeof CONFIG_VERSION;
  readonly format: Format;
  readonly topics: readonly Topic[];
}

/** Bounds that `parseConfig` enforces. */
export const LIMITS = {
  /** Seconds of a timed step (per clock for a free round). */
  stepSeconds: { min: 1, max: 3600 },
  teamSize: { min: 1, max: 8 },
  steps: { min: 1, max: 50 },
  topics: { min: 1, max: 100 },
  topicLength: 300,
  stepLabelLength: 60,
  sideLabelLength: 30,
  idLength: 40,
} as const;

// Letters, digits and dashes, starting with a letter or digit. Ids become
// object keys in a session, so nothing like `__proto__` may get through.
const ID_PATTERN = new RegExp(`^[A-Za-z0-9][A-Za-z0-9-]{0,${LIMITS.idLength - 1}}$`);

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

/** `prefix` plus the lowest number ≥ 1 that is not taken yet: `t1`, `t2`, … */
export function nextId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

/** Planned seconds per clock, or `null` for a step without a timer. */
export function stepSeconds(step: Step): number | null {
  switch (step.type) {
    case 'speech':
    case 'consultation':
    case 'free-round':
      return step.seconds;
    case 'vote-before':
    case 'vote-after':
      return null;
  }
}

/** Planned seconds of the whole step: a free round has two clocks. */
export function stepTotalSeconds(step: Step): number {
  switch (step.type) {
    case 'speech':
    case 'consultation':
      return step.seconds;
    case 'free-round':
      return step.seconds * 2;
    case 'vote-before':
    case 'vote-after':
      return 0;
  }
}

/** Planned length of a debate in this format, in seconds. */
export function formatTotalSeconds(format: Format): number {
  return format.steps.reduce((total, step) => total + stepTotalSeconds(step), 0);
}

/** The side a step belongs to, or `null` for a step of both teams or of the audience. */
export function stepSide(step: Step): Side | null {
  switch (step.type) {
    case 'speech':
      return step.side;
    case 'consultation':
    case 'free-round':
    case 'vote-before':
    case 'vote-after':
      return null;
  }
}
