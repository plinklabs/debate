// The private half of the model: the debates a class holds, with the
// students' names and everything recorded while they debate (timings,
// speakers, votes). A session stays in this browser (storage.ts) and in the
// exported report. It is never part of a link or a config file: config.ts
// cannot import anything from here.
//
// Topics and debates are separate, so one topic can be debated by several
// groups. A debate refers to its topic and to the steps of the format by id;
// what was recorded is kept per step id, so reordering the steps does not mix
// up results.

import { SIDES, type Format, type Side, type Step, type VoteStep } from './config';
import { IDLE_TIMER, isRunning, pauseTimer, type Timer } from './timer';
import { NO_VOTES, voteShift, type Shift, type Votes } from './votes';

export const MAX_NAME_LENGTH = 40;

/**
 * Names per side, by slot. An empty string is an unused slot. Records refer to
 * students by slot, so clearing a name never shifts the others.
 */
export type Teams = Readonly<Record<Side, readonly string[]>>;

export interface Member {
  readonly slot: number;
  readonly name: string;
}

export interface Speaker {
  readonly side: Side;
  readonly slot: number;
}

/** A speech: one timer, and who spoke. */
export interface SpeechRecord {
  readonly type: 'speech';
  readonly timer: Timer;
  /** Slots (on the step's side) that spoke in this turn, in order of first tap. */
  readonly speakers: readonly number[];
  /** Slot that has the floor now. */
  readonly current: number | null;
}

export interface ConsultationRecord {
  readonly type: 'consultation';
  readonly timer: Timer;
}

/** A free round: a chess clock with one clock per team. */
export interface FreeRoundRecord {
  readonly type: 'free-round';
  readonly clocks: Readonly<Record<Side, Timer>>;
  /** Side whose clock runs now; `null` when both stand still. */
  readonly active: Side | null;
  /** Side whose clock ran last; a resume continues there. */
  readonly lastSide: Side | null;
  readonly current: Speaker | null;
  /** How many times the clock switched to this team. */
  readonly teamTurns: Readonly<Record<Side, number>>;
  /** Turns per student, indexed by slot. */
  readonly speakerTurns: Readonly<Record<Side, readonly number[]>>;
}

export interface VoteRecord<T extends VoteStep['type'] = VoteStep['type']> {
  readonly type: T;
  readonly votes: Votes;
}

/** What was recorded for one step; `type` is the type of that step. */
export type StepRecord =
  | SpeechRecord
  | ConsultationRecord
  | FreeRoundRecord
  | VoteRecord<'vote-before'>
  | VoteRecord<'vote-after'>;

/** The record that belongs to a step of type `S['type']`. */
export type RecordFor<S extends Step> = Extract<StepRecord, { readonly type: S['type'] }>;

export interface Debate {
  readonly id: string;
  readonly topicId: string;
  readonly teams: Teams;
  /** Index of the current step. Read it through `stepIndexOf`: the format may have changed. */
  readonly step: number;
  /** Results per step id. A step without an entry has not been touched yet. */
  readonly records: Readonly<Record<string, StepRecord>>;
  readonly done: boolean;
}

export interface Session {
  readonly debates: readonly Debate[];
  /** Id of the debate that is open, or `null`. Only the open debate's timers can run. */
  readonly current: string | null;
}

export function emptySession(): Session {
  return { debates: [], current: null };
}

export function newDebate(id: string, topicId: string, format: Format): Debate {
  const slots = () => Array.from({ length: format.teamSize.max }, () => '');
  return { id, topicId, teams: { pro: slots(), con: slots() }, step: 0, records: {}, done: false };
}

/** The filled-in names of one side, with their slot. */
export function membersOf(teams: Teams, side: Side): Member[] {
  return teams[side]
    .map((raw, slot) => ({ slot, name: raw.trim() }))
    .filter((member) => member.name !== '');
}

export function isTeamComplete(format: Format, teams: Teams, side: Side): boolean {
  const size = membersOf(teams, side).length;
  return size >= format.teamSize.min && size <= format.teamSize.max;
}

/** A debate can start when both teams are complete. */
export function isPlayable(format: Format, debate: Debate): boolean {
  return SIDES.every((side) => isTeamComplete(format, debate.teams, side));
}

export function stepIndexOf(format: Format, debate: Debate): number {
  return Math.max(0, Math.min(debate.step, format.steps.length - 1));
}

/**
 * How many name slots a side has on screen: the format's largest team, or
 * more when names are left in slots beyond it (the team size went down after
 * they were typed), so those can still be seen and cleared.
 */
export function slotCount(format: Format, teams: Teams, side: Side): number {
  const filled = teams[side].reduce(
    (last, name, slot) => (name.trim() === '' ? last : slot + 1),
    0,
  );
  return Math.max(format.teamSize.max, filled);
}

/** A debate has results once anything was recorded in it, or once it was finished. */
export function hasResults(debate: Debate): boolean {
  return debate.done || Object.keys(debate.records).length > 0;
}

/** The topics that debates are about, by id. */
export function debatedTopicIds(session: Session): Set<string> {
  return new Set(session.debates.map((debate) => debate.topicId));
}

/**
 * Ids of steps that have something recorded in some debate. A new step must
 * not take one of these, or it would show results that are not its own.
 */
export function recordedStepIds(session: Session): Set<string> {
  return new Set(session.debates.flatMap((debate) => Object.keys(debate.records)));
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export function emptyFreeRound(): FreeRoundRecord {
  return {
    type: 'free-round',
    clocks: { pro: IDLE_TIMER, con: IDLE_TIMER },
    active: null,
    lastSide: null,
    current: null,
    teamTurns: { pro: 0, con: 0 },
    speakerTurns: { pro: [], con: [] },
  };
}

function emptyRecord(step: Step): StepRecord {
  switch (step.type) {
    case 'speech':
      return { type: 'speech', timer: IDLE_TIMER, speakers: [], current: null };
    case 'consultation':
      return { type: 'consultation', timer: IDLE_TIMER };
    case 'free-round':
      return emptyFreeRound();
    case 'vote-before':
    case 'vote-after':
      return { type: step.type, votes: NO_VOTES };
  }
}

/** What was recorded for a step of this debate, or an empty record. */
export function recordFor<S extends Step>(debate: Debate, step: S): RecordFor<S> {
  const stored = Object.hasOwn(debate.records, step.id) ? debate.records[step.id] : undefined;
  // A record of another type is left over from before the step was edited.
  const record = stored !== undefined && stored.type === step.type ? stored : emptyRecord(step);
  return record as RecordFor<S>;
}

export function withRecord<S extends Step>(debate: Debate, step: S, record: RecordFor<S>): Debate {
  return { ...debate, records: { ...debate.records, [step.id]: record } };
}

export function withoutRecord(debate: Debate, step: Step): Debate {
  if (!Object.hasOwn(debate.records, step.id)) return debate;
  const records = Object.fromEntries(
    Object.entries(debate.records).filter(([id]) => id !== step.id),
  );
  return { ...debate, records };
}

/** Turns per student in a free round, as recorded. */
export function freeRoundTurns(record: FreeRoundRecord, side: Side, slot: number): number {
  return record.speakerTurns[side][slot] ?? 0;
}

// ---------------------------------------------------------------------------
// Running and pausing
// ---------------------------------------------------------------------------

export function pauseFreeRound(round: FreeRoundRecord, now: number): FreeRoundRecord {
  if (round.active === null) return round;
  return {
    ...round,
    clocks: { ...round.clocks, [round.active]: pauseTimer(round.clocks[round.active], now) },
    active: null,
  };
}

function pauseRecord(record: StepRecord, now: number): StepRecord {
  switch (record.type) {
    case 'speech':
    case 'consultation':
      return isRunning(record.timer) ? { ...record, timer: pauseTimer(record.timer, now) } : record;
    case 'free-round':
      return pauseFreeRound(record, now);
    case 'vote-before':
    case 'vote-after':
      return record;
  }
}

function recordRunning(record: StepRecord): boolean {
  switch (record.type) {
    case 'speech':
    case 'consultation':
      return isRunning(record.timer);
    case 'free-round':
      return record.active !== null;
    case 'vote-before':
    case 'vote-after':
      return false;
  }
}

export function debateRunning(debate: Debate): boolean {
  return Object.values(debate.records).some(recordRunning);
}

/** A clock of a timed step. */
export interface StepClock {
  /** The team whose clock this is in a free round; `null` for the one clock of any other step. */
  readonly side: Side | null;
  /** Planned seconds on this clock. */
  readonly seconds: number;
  readonly timer: Timer;
}

/**
 * The clocks of a step in this debate: one for a speech or a consultation, one
 * per team in a free round (a chess clock), none for a vote. At most one of
 * them runs.
 */
export function clocksOf(debate: Debate, step: Step): readonly StepClock[] {
  switch (step.type) {
    case 'speech':
    case 'consultation':
      return [{ side: null, seconds: step.seconds, timer: recordFor(debate, step).timer }];
    case 'free-round': {
      const { clocks } = recordFor(debate, step);
      return SIDES.map((side) => ({ side, seconds: step.seconds, timer: clocks[side] }));
    }
    case 'vote-before':
    case 'vote-after':
      return [];
  }
}

/** The clock of this step that runs now, or `null`. */
export function runningClock(debate: Debate, step: Step): StepClock | null {
  return clocksOf(debate, step).find((clock) => isRunning(clock.timer)) ?? null;
}

/** Stop whatever runs in this debate. */
export function pauseDebate(debate: Debate, now: number): Debate {
  if (!debateRunning(debate)) return debate;
  const records: Record<string, StepRecord> = {};
  for (const [id, record] of Object.entries(debate.records)) records[id] = pauseRecord(record, now);
  return { ...debate, records };
}

/** Every timer of every debate paused at its elapsed time. */
export function pauseSession(session: Session, now: number): Session {
  if (!session.debates.some(debateRunning)) return session;
  return { ...session, debates: session.debates.map((debate) => pauseDebate(debate, now)) };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** Turns of one student: the speeches they spoke in, plus their turns in free rounds. */
export function turnsOf(format: Format, debate: Debate, side: Side, slot: number): number {
  let turns = 0;
  for (const step of format.steps) {
    if (step.type === 'speech' && step.side === side) {
      if (recordFor(debate, step).speakers.includes(slot)) turns += 1;
    } else if (step.type === 'free-round') {
      turns += freeRoundTurns(recordFor(debate, step), side, slot);
    }
  }
  return turns;
}

/** The counts of the format's vote of this type, or `null` when the format has no such vote. */
export function votesOf(format: Format, debate: Debate, type: VoteStep['type']): Votes | null {
  const step = format.steps.find((candidate): candidate is VoteStep => candidate.type === type);
  return step === undefined ? null : recordFor(debate, step).votes;
}

/** The shift between the vote before and the vote after, or `null` when the format lacks one. */
export function shiftOf(format: Format, debate: Debate): Shift | null {
  const before = votesOf(format, debate, 'vote-before');
  const after = votesOf(format, debate, 'vote-after');
  return before === null || after === null ? null : voteShift(before, after);
}
