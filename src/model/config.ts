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

/** The side across from this one. */
export function otherSide(side: Side): Side {
  return side === 'pro' ? 'con' : 'pro';
}

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

/**
 * One side asks questions and the other may only answer (#8). One timer, and
 * it belongs to the asking side.
 */
export interface CrossExaminationStep extends StepBase {
  readonly type: 'cross-examination';
  readonly askingSide: Side;
  readonly seconds: number;
}

/** A timed open round in which the audience puts questions to both teams (#8); one timer. */
export interface AudienceQuestionsStep extends StepBase {
  readonly type: 'audience-questions';
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
export type Step =
  | SpeechStep
  | ConsultationStep
  | FreeRoundStep
  | CrossExaminationStep
  | AudienceQuestionsStep
  | VoteBeforeStep
  | VoteAfterStep;

export type StepType = Step['type'];

export type TimedStep =
  SpeechStep | ConsultationStep | FreeRoundStep | CrossExaminationStep | AudienceQuestionsStep;

export type VoteStep = VoteBeforeStep | VoteAfterStep;

// A record, so the compiler checks that the list names every type, and no other.
const STEP_TYPE_SET: Readonly<Record<StepType, true>> = {
  speech: true,
  consultation: true,
  'free-round': true,
  'cross-examination': true,
  'audience-questions': true,
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

/**
 * A bank of prep time (#8): each team has `secondsPerTeam` in all, and calls
 * for some of it whenever it wants, between steps or during one. What the
 * teams use is recorded per debate (session.ts).
 */
export interface PrepTime {
  readonly secondsPerTeam: number;
}

export interface Format {
  /** What each side is called on screen (VOOR/TEGEN, Pro/Contra, …). */
  readonly sides: Readonly<Record<Side, string>>;
  readonly teamSize: TeamSize;
  /**
   * The prep-time bank, or no field at all for a format without one. Optional
   * rather than `null`, so a format without a bank, such as every format from
   * before #8, reads and shares exactly as it did.
   */
  readonly prepTime?: PrepTime;
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
  /** Seconds of prep time in each team's bank. */
  prepSeconds: { min: 1, max: 3600 },
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
    case 'cross-examination':
    case 'audience-questions':
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
    case 'cross-examination':
    case 'audience-questions':
      return step.seconds;
    case 'free-round':
      return step.seconds * 2;
    case 'vote-before':
    case 'vote-after':
      return 0;
  }
}

/** Planned length of a debate in this format, in seconds: every step, and both prep-time banks. */
export function formatTotalSeconds(format: Format): number {
  const prep = format.prepTime === undefined ? 0 : format.prepTime.secondsPerTeam * SIDES.length;
  return format.steps.reduce((total, step) => total + stepTotalSeconds(step), prep);
}

/**
 * The side a step belongs to, or `null` for a step of both teams or of the
 * audience. A cross-examination belongs to the side that asks: its clock is theirs.
 */
export function stepSide(step: Step): Side | null {
  switch (step.type) {
    case 'speech':
      return step.side;
    case 'cross-examination':
      return step.askingSide;
    case 'consultation':
    case 'free-round':
    case 'audience-questions':
    case 'vote-before':
    case 'vote-after':
      return null;
  }
}
