// The results of a session as a report reads them (#7): per debate the topic
// and the teams, planned against used time per clock of every timed step, who
// spoke and how often, who asked and answered in each cross-examination, the
// balance of each free round, the answers to the audience, the prep time each
// team used, the audience vote with its shift, and the jury's scores (#10). Plain data, with the names
// in it, so it stays on the private side of the model; the HTML report and the
// CSV (src/report/) only lay it out.
//
// A report covers the debates that have results (`hasResults`), in the order
// of the session, and follows the format as it is now: a step that is no
// longer in the format is not in the report.

import {
  otherSide,
  type AudienceQuestionsStep,
  type ConsultationStep,
  type CrossExaminationStep,
  type DebateConfig,
  type Format,
  type FreeRoundStep,
  type JuryStep,
  type Rubric,
  type Side,
  type SpeechStep,
  type Step,
  type Topic,
  type VoteStep,
} from './config';
import { averageSheet, hasScored, juryOf, scoreTargets, sheetOf, type Sheet } from './jury';
import {
  clocksOf,
  freeRoundTurns,
  hasResults,
  membersOf,
  prepClocks,
  recordFor,
  type Debate,
  type Member,
  type Session,
  type StepClock,
} from './session';
import { elapsedMs, timingOf, type Timing } from './timer';
import { voteShift, type Shift, type Votes } from './votes';

/** One clock of a timed step. */
export interface ClockResult {
  /** The team of a free-round clock; `null` for the one clock of any other step. */
  readonly side: Side | null;
  /** Planned seconds on this clock. */
  readonly planned: number;
  /** What was used, in whole seconds; `null` when the clock never ran. */
  readonly timing: Timing | null;
}

export interface SpeechResult {
  readonly type: 'speech';
  readonly step: SpeechStep;
  readonly clock: ClockResult;
  /** Who spoke in this turn, in order of first tap. */
  readonly speakers: readonly Member[];
}

export interface CrossExaminationResult {
  readonly type: 'cross-examination';
  readonly step: CrossExaminationStep;
  readonly clock: ClockResult;
  /** Who asked, on the asking side, in order of first tap. */
  readonly askers: readonly Member[];
  /** Who answered, on the other side, in order of first tap. */
  readonly answerers: readonly Member[];
}

export interface AudienceQuestionsResult {
  readonly type: 'audience-questions';
  readonly step: AudienceQuestionsStep;
  readonly clock: ClockResult;
  /** Answers each team gave, as counted; 0 and 0 when nobody counted. */
  readonly answers: Readonly<Record<Side, number>>;
}

export interface ConsultationResult {
  readonly type: 'consultation';
  readonly step: ConsultationStep;
  readonly clock: ClockResult;
}

/** A student's turns in one free round. */
export interface FreeRoundSpeaker extends Member {
  readonly turns: number;
}

export interface FreeRoundResult {
  readonly type: 'free-round';
  readonly step: FreeRoundStep;
  readonly clocks: Readonly<Record<Side, ClockResult>>;
  /** How many times the clock switched to each team. */
  readonly teamTurns: Readonly<Record<Side, number>>;
  /** Each team's part of the time used, from 0 to 1; `null` when neither clock ran. */
  readonly share: Readonly<Record<Side, number>> | null;
  readonly speakers: Readonly<Record<Side, readonly FreeRoundSpeaker[]>>;
}

export interface VoteResult<T extends VoteStep['type'] = VoteStep['type']> {
  readonly type: T;
  readonly step: Extract<VoteStep, { readonly type: T }>;
  readonly votes: Votes;
  /** Whether hands were counted at this step: no count is not the same as 0 against 0. */
  readonly counted: boolean;
}

/** A juror who gave any score. */
export interface JurorResult {
  readonly id: string;
  /** Their place on the jury, from 1: "Juror 2" for one without a name. */
  readonly number: number;
  /** As typed, without the spaces around it; may be empty. */
  readonly name: string;
}

/** The scores of one team, or of one student. */
export interface ScoredResult {
  readonly side: Side;
  /** The student when the rubric scores students; `null` for a team. */
  readonly member: Member | null;
  /** Each juror's sheet, in the order of `JuryResult.jurors`. */
  readonly sheets: readonly Sheet[];
  /** The sheets averaged: each criterion and the total over the jurors who scored them. */
  readonly average: Sheet;
}

/** The jury's scores (#10). They are the debate's, and the jury step shows them. */
export interface JuryResult {
  readonly type: 'jury';
  readonly step: JuryStep;
  /** `null` only in a format without a rubric, which does not validate. */
  readonly rubric: Rubric | null;
  /** The jurors who gave any score, in the order of the jury. */
  readonly jurors: readonly JurorResult[];
  /** Every team or student the rubric scores, scored or not. */
  readonly scored: readonly ScoredResult[];
}

/**
 * What a report holds for one step, discriminated on `type` like `Step`. A
 * new kind of step gets a member here and a case in `stepResult`; the
 * builders in src/report/ then fail to compile until they lay it out.
 */
export type StepResult =
  | SpeechResult
  | ConsultationResult
  | FreeRoundResult
  | CrossExaminationResult
  | AudienceQuestionsResult
  | VoteResult<'vote-before'>
  | VoteResult<'vote-after'>
  | JuryResult;

/** A student and how often they spoke. */
export interface MemberResult extends Member {
  /** Speeches they spoke in. */
  readonly speeches: number;
  /** Cross-examinations they asked or answered in. */
  readonly crossExaminations: number;
  /** Their turns in the free rounds. */
  readonly freeRoundTurns: number;
  /** Both together (`turnsOf`). */
  readonly turns: number;
}

/** The audience vote; a part is `null` when the format has no such vote. */
export interface VoteSummary {
  readonly before: VoteResult<'vote-before'> | null;
  readonly after: VoteResult<'vote-after'> | null;
  /** `null` unless the format has both votes; its `pp` is `null` until each has a hand. */
  readonly shift: Shift | null;
}

/** The prep time of a debate: each team's bank, and what it used of it. */
export interface PrepResult {
  /** Seconds in each team's bank. */
  readonly secondsPerTeam: number;
  /**
   * Each team's clock. Its `timing` is always there, an unused bank as 0 used:
   * prep time is not a step that was or was not held. `rest` is what is left,
   * `overtime` what the team used beyond its bank.
   */
  readonly clocks: Readonly<Record<Side, ClockResult & { readonly timing: Timing }>>;
}

export interface DebateResult {
  readonly id: string;
  /** Position in the session's list of debates, from 1: "Debate 2". */
  readonly number: number;
  /** `null` when the topic is no longer in the setup. */
  readonly topic: Topic | null;
  readonly done: boolean;
  readonly teams: Readonly<Record<Side, readonly MemberResult[]>>;
  /** Every step of the format, in order. */
  readonly steps: readonly StepResult[];
  /** `null` when the format has no vote. */
  readonly vote: VoteSummary | null;
  /** `null` when the format has no prep-time bank. */
  readonly prep: PrepResult | null;
}

export interface Report {
  readonly format: Format;
  readonly debates: readonly DebateResult[];
}

/**
 * The report of a session: every debate with results. `now` is the time of a
 * clock that may still run (milliseconds on the same clock as its timers).
 */
export function buildReport(config: DebateConfig, session: Session, now: number): Report {
  const { format } = config;
  const debates: DebateResult[] = [];
  session.debates.forEach((debate, index) => {
    if (hasResults(debate)) debates.push(debateResult(config, debate, index + 1, now));
  });
  return { format, debates };
}

function debateResult(
  config: DebateConfig,
  debate: Debate,
  number: number,
  now: number,
): DebateResult {
  const { format } = config;
  const steps = format.steps.map((step) => stepResult(debate, step, now, format.rubric));
  const before = steps.find((r): r is VoteResult<'vote-before'> => r.type === 'vote-before');
  const after = steps.find((r): r is VoteResult<'vote-after'> => r.type === 'vote-after');
  return {
    id: debate.id,
    number,
    topic: config.topics.find((topic) => topic.id === debate.topicId) ?? null,
    done: debate.done,
    teams: {
      pro: memberResults(steps, debate, 'pro'),
      con: memberResults(steps, debate, 'con'),
    },
    steps,
    vote:
      before === undefined && after === undefined
        ? null
        : {
            before: before ?? null,
            after: after ?? null,
            shift:
              before === undefined || after === undefined
                ? null
                : voteShift(before.votes, after.votes),
          },
    prep: prepResult(format, debate, now),
  };
}

function prepResult(format: Format, debate: Debate, now: number): PrepResult | null {
  if (format.prepTime === undefined) return null;
  const clocks = prepClocks(format, debate);
  const clock = (side: Side) => {
    const found = clocks.find((candidate) => candidate.side === side) ?? clocks[0];
    const elapsed = elapsedMs(found.timer, now);
    return { side, planned: found.seconds, timing: timingOf(found.seconds, elapsed) };
  };
  return {
    secondsPerTeam: format.prepTime.secondsPerTeam,
    clocks: { pro: clock('pro'), con: clock('con') },
  };
}

/**
 * What the report holds for one step. The switch covers every kind of step;
 * the jury's needs the format's `rubric`.
 */
export function stepResult(
  debate: Debate,
  step: Step,
  now: number,
  rubric: Rubric | undefined,
): StepResult {
  switch (step.type) {
    case 'speech': {
      const members = membersOf(debate.teams, step.side);
      const speakers = recordFor(debate, step)
        .speakers.map((slot) => members.find((member) => member.slot === slot))
        .filter((member) => member !== undefined);
      return { type: step.type, step, clock: onlyClock(debate, step, now), speakers };
    }
    case 'consultation':
      return { type: step.type, step, clock: onlyClock(debate, step, now) };
    case 'cross-examination': {
      const record = recordFor(debate, step);
      const named = (side: Side, slots: readonly number[]) => {
        const members = membersOf(debate.teams, side);
        return slots
          .map((slot) => members.find((member) => member.slot === slot))
          .filter((member) => member !== undefined);
      };
      return {
        type: step.type,
        step,
        clock: onlyClock(debate, step, now),
        askers: named(step.askingSide, record.askers),
        answerers: named(otherSide(step.askingSide), record.answerers),
      };
    }
    case 'audience-questions':
      return {
        type: step.type,
        step,
        clock: onlyClock(debate, step, now),
        answers: recordFor(debate, step).answers,
      };
    case 'free-round': {
      const round = recordFor(debate, step);
      const clock = (side: Side) =>
        clockResult({ side, seconds: step.seconds, timer: round.clocks[side] }, now);
      const clocks = { pro: clock('pro'), con: clock('con') };
      const used = (side: Side) => clocks[side].timing?.used ?? 0;
      const total = used('pro') + used('con');
      const speakers = (side: Side) =>
        membersOf(debate.teams, side).map((member) => ({
          ...member,
          turns: freeRoundTurns(round, side, member.slot),
        }));
      return {
        type: step.type,
        step,
        clocks,
        teamTurns: round.teamTurns,
        share: total > 0 ? { pro: used('pro') / total, con: used('con') / total } : null,
        speakers: { pro: speakers('pro'), con: speakers('con') },
      };
    }
    case 'vote-before':
      return { type: step.type, step, ...voteOf(debate, step) };
    case 'vote-after':
      return { type: step.type, step, ...voteOf(debate, step) };
    case 'jury':
      return juryResult(debate, step, rubric ?? null);
  }
}

function juryResult(debate: Debate, step: JuryStep, rubric: Rubric | null): JuryResult {
  if (rubric === null) return { type: 'jury', step, rubric, jurors: [], scored: [] };
  const jury = juryOf(debate);
  const targets = scoreTargets(rubric, debate.teams);
  // Only the jurors who scored anything: an empty sheet says nothing.
  const jurors = jury.jurors
    .map((juror, index) => ({ juror, number: index + 1 }))
    .filter(({ juror }) => targets.some((target) => hasScored(sheetOf(rubric, juror, target))));
  const scored = targets.map((target): ScoredResult => {
    const sheets = jurors.map(({ juror }) => sheetOf(rubric, juror, target));
    const members = membersOf(debate.teams, target.side);
    return {
      side: target.side,
      member:
        target.slot === null
          ? null
          : (members.find((member) => member.slot === target.slot) ?? null),
      sheets,
      average: averageSheet(rubric, sheets),
    };
  });
  return {
    type: 'jury',
    step,
    rubric,
    jurors: jurors.map(({ juror, number }) => ({ id: juror.id, number, name: juror.name.trim() })),
    scored,
  };
}

function voteOf(debate: Debate, step: VoteStep): { votes: Votes; counted: boolean } {
  return { votes: recordFor(debate, step).votes, counted: Object.hasOwn(debate.records, step.id) };
}

function clockResult(clock: StepClock, now: number): ClockResult {
  const elapsed = elapsedMs(clock.timer, now);
  return {
    side: clock.side,
    planned: clock.seconds,
    timing: elapsed > 0 ? timingOf(clock.seconds, elapsed) : null,
  };
}

function onlyClock(
  debate: Debate,
  step: SpeechStep | ConsultationStep | CrossExaminationStep | AudienceQuestionsStep,
  now: number,
): ClockResult {
  const [clock] = clocksOf(debate, step);
  return clockResult(clock, now);
}

function memberResults(steps: readonly StepResult[], debate: Debate, side: Side): MemberResult[] {
  const isMember = (list: readonly Member[], member: Member) =>
    list.some((other) => other.slot === member.slot);
  return membersOf(debate.teams, side).map((member) => {
    let speeches = 0;
    let crossExaminations = 0;
    let freeRound = 0;
    for (const result of steps) {
      if (result.type === 'speech' && result.step.side === side) {
        if (isMember(result.speakers, member)) speeches += 1;
      } else if (result.type === 'cross-examination') {
        const asking = result.step.askingSide === side;
        if (isMember(asking ? result.askers : result.answerers, member)) crossExaminations += 1;
      } else if (result.type === 'free-round') {
        freeRound += result.speakers[side].find((s) => s.slot === member.slot)?.turns ?? 0;
      }
    }
    return {
      ...member,
      speeches,
      crossExaminations,
      freeRoundTurns: freeRound,
      turns: speeches + crossExaminations + freeRound,
    };
  });
}

/** Whether the format has a step of this kind: a column or a section the report needs. */
export function formatHas(format: Format, type: Step['type']): boolean {
  return format.steps.some((step) => step.type === type);
}
