// The app state and the reducer that changes it. Time only enters through the
// `now` of an action (milliseconds on a monotonic clock), so a whole debate can
// be replayed in a test with a fake clock.

import {
  LIMITS,
  nextId,
  otherSide,
  type DebateConfig,
  type Side,
  type Step,
  type Topic,
} from './config';
import {
  MAX_NAME_LENGTH,
  debateRunning,
  emptySession,
  isPlayable,
  membersOf,
  newDebate,
  pauseDebate,
  pauseFreeRound,
  pausePrep,
  pauseSession,
  pauseSteps,
  recordFor,
  stepIndexOf,
  stepsRunning,
  withRecord,
  withoutRecord,
  type Debate,
  type FreeRoundRecord,
  type Session,
} from './session';
import { isRunning, pauseTimer, startTimer, type Timer } from './timer';
import { clampVotes } from './votes';

export interface AppState {
  /** The setup: format and topics. Shareable. */
  readonly config: DebateConfig;
  /** What the class did with it: names, timings, votes. Private. */
  readonly session: Session;
}

export function initialState(config: DebateConfig): AppState {
  return { config, session: emptySession() };
}

export type Action =
  /** Replace the setup (a preset, an edited format, an imported link). Stops every timer. */
  | { readonly type: 'set-config'; readonly config: DebateConfig; readonly now: number }
  | { readonly type: 'add-debate'; readonly topicId: string }
  | { readonly type: 'remove-debate'; readonly debateId: string }
  | {
      readonly type: 'set-name';
      readonly debateId: string;
      readonly side: Side;
      readonly slot: number;
      readonly name: string;
    }
  | { readonly type: 'open-debate'; readonly debateId: string; readonly now: number }
  | { readonly type: 'close-debate'; readonly now: number }
  | { readonly type: 'finish-debate'; readonly now: number }
  // The actions below act on the open debate and its current step.
  | { readonly type: 'go-to-step'; readonly step: number; readonly now: number }
  | { readonly type: 'next-step'; readonly now: number }
  | { readonly type: 'previous-step'; readonly now: number }
  | { readonly type: 'toggle-timer'; readonly now: number }
  | {
      readonly type: 'tap-speaker';
      readonly side: Side;
      readonly slot: number;
      readonly now: number;
    }
  /** Take a student off the list of who spoke, asked or answered in the current step. */
  | { readonly type: 'remove-speaker'; readonly side: Side; readonly slot: number }
  | {
      readonly type: 'adjust-free-turns';
      readonly side: Side;
      readonly slot: number;
      readonly delta: number;
    }
  /** Count an answer of a team to the audience (`delta` 1), or take one back (−1). */
  | { readonly type: 'adjust-answers'; readonly side: Side; readonly delta: number }
  | { readonly type: 'clear-step' }
  | { readonly type: 'set-votes'; readonly side: Side; readonly value: number }
  /**
   * A team calls prep time, or pauses it. It stops the clock of the step and
   * any prep time of the other team; going on with the step is up to the
   * teacher (`toggle-timer`, or a tap on a name), which in turn stops it.
   */
  | { readonly type: 'toggle-prep'; readonly side: Side; readonly now: number }
  /** Forget every debate, name and result; keep the setup. */
  | { readonly type: 'reset-session' }
  /**
   * Replace everything with a state saved elsewhere: a report opened in the
   * app (#7), already checked (`readReportFile`). Its timers are paused.
   */
  | { readonly type: 'load-state'; readonly state: AppState };

export interface OpenDebate {
  readonly debate: Debate;
  /** `undefined` when the topic was removed from the setup after the debate was made. */
  readonly topic: Topic | undefined;
  readonly step: Step;
  readonly stepIndex: number;
}

/** The open debate and its current step, or `null` when no debate is open. */
export function currentDebate(state: AppState): OpenDebate | null {
  const { config, session } = state;
  if (session.current === null) return null;
  const debate = session.debates.find((candidate) => candidate.id === session.current);
  if (debate === undefined || config.format.steps.length === 0) return null;
  const stepIndex = stepIndexOf(config.format, debate);
  return {
    debate,
    topic: config.topics.find((topic) => topic.id === debate.topicId),
    step: config.format.steps[stepIndex],
    stepIndex,
  };
}

/**
 * A copy with every running timer paused at its elapsed time. This is what
 * gets stored: timestamps from `performance.now()` mean nothing after a
 * reload, elapsed time does.
 */
export function freeze(state: AppState, now: number): AppState {
  const session = pauseSession(state.session, now);
  return session === state.session ? state : { ...state, session };
}

export function anyRunning(state: AppState): boolean {
  return state.session.debates.some(debateRunning);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-config':
      return { config: action.config, session: pauseSession(state.session, action.now) };
    case 'add-debate': {
      if (!state.config.topics.some((topic) => topic.id === action.topicId)) return state;
      const { debates } = state.session;
      const taken = debates.map((debate) => debate.id);
      const debate = newDebate(nextId('d', taken), action.topicId, state.config.format);
      return withSession(state, { ...state.session, debates: [...debates, debate] });
    }
    case 'remove-debate': {
      const { debates, current } = state.session;
      if (!debates.some((debate) => debate.id === action.debateId)) return state;
      return withSession(state, {
        debates: debates.filter((debate) => debate.id !== action.debateId),
        current: current === action.debateId ? null : current,
      });
    }
    case 'set-name':
      // A slot of the format, or one the team already has: names left beyond a
      // team size that went down can still be corrected or cleared.
      return updateDebate(state, action.debateId, (debate) =>
        isSlot(
          action.slot,
          Math.max(state.config.format.teamSize.max, debate.teams[action.side].length),
        )
          ? setName(debate, action.side, action.slot, action.name)
          : debate,
      );
    case 'open-debate': {
      const debate = findDebate(state.session, action.debateId);
      if (debate === undefined || !isPlayable(state.config.format, debate)) return state;
      // Nothing in another debate may keep running.
      const session = pauseSession(state.session, action.now);
      return withSession(state, { ...session, current: debate.id });
    }
    case 'close-debate': {
      if (state.session.current === null) return state;
      return withSession(state, { ...pauseSession(state.session, action.now), current: null });
    }
    case 'finish-debate': {
      const open = currentDebate(state);
      if (open === null) return state;
      const finished = replaceDebate(state, {
        ...pauseDebate(open.debate, action.now),
        done: true,
      });
      return withSession(finished, { ...finished.session, current: null });
    }
    case 'go-to-step':
      return updateOpen(state, (open) => moveTo(state, open, action.step, action.now));
    case 'next-step':
      return updateOpen(state, (open) => moveTo(state, open, open.stepIndex + 1, action.now));
    case 'previous-step':
      return updateOpen(state, (open) => moveTo(state, open, open.stepIndex - 1, action.now));
    case 'toggle-timer':
      return updateOpen(state, (open) => endPrep(toggleTimer(open, action.now), action.now));
    case 'tap-speaker':
      return updateOpen(state, (open) =>
        endPrep(tapSpeaker(open, action.side, action.slot, action.now), action.now),
      );
    case 'remove-speaker':
      return updateOpen(state, (open) => removeSpeaker(open, action.side, action.slot));
    case 'adjust-free-turns':
      return updateOpen(state, (open) =>
        adjustFreeTurns(open, action.side, action.slot, action.delta),
      );
    case 'adjust-answers':
      return updateOpen(state, (open) => adjustAnswers(open, action.side, action.delta));
    case 'clear-step':
      return updateOpen(state, (open) => withoutRecord(open.debate, open.step));
    case 'set-votes':
      return updateOpen(state, (open) => setVotes(open, action.side, action.value));
    case 'toggle-prep':
      return state.config.format.prepTime === undefined
        ? state
        : updateOpen(state, ({ debate }) => togglePrep(debate, action.side, action.now));
    case 'reset-session':
      return withSession(state, emptySession());
    case 'load-state':
      return { config: action.state.config, session: action.state.session };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withSession(state: AppState, session: Session): AppState {
  return { ...state, session };
}

function findDebate(session: Session, id: string): Debate | undefined {
  return session.debates.find((debate) => debate.id === id);
}

function replaceDebate(state: AppState, next: Debate): AppState {
  return withSession(state, {
    ...state.session,
    debates: state.session.debates.map((debate) => (debate.id === next.id ? next : debate)),
  });
}

function updateDebate(state: AppState, id: string, update: (debate: Debate) => Debate): AppState {
  const debate = findDebate(state.session, id);
  if (debate === undefined) return state;
  const next = update(debate);
  return next === debate ? state : replaceDebate(state, next);
}

function updateOpen(state: AppState, update: (open: OpenDebate) => Debate): AppState {
  const open = currentDebate(state);
  if (open === null) return state;
  const next = update(open);
  return next === open.debate ? state : replaceDebate(state, next);
}

function isSlot(slot: number, slots: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < slots;
}

function setName(debate: Debate, side: Side, slot: number, name: string): Debate {
  const names = [...debate.teams[side]];
  while (names.length <= slot) names.push('');
  names[slot] = name.slice(0, MAX_NAME_LENGTH);
  return { ...debate, teams: { ...debate.teams, [side]: names } };
}

function moveTo(state: AppState, open: OpenDebate, target: number, now: number): Debate {
  if (!isSlot(target, state.config.format.steps.length) || target === open.stepIndex) {
    return open.debate;
  }
  // Leaving a step stops its clock. Entering one never starts it. Prep time
  // belongs to no step, and goes on.
  return { ...pauseSteps(open.debate, now), step: target };
}

/** Once the clock of a step runs, prep time is over: it stops. */
function endPrep(debate: Debate, now: number): Debate {
  return stepsRunning(debate) ? pausePrep(debate, now) : debate;
}

/**
 * A team calls prep time: the clock of the step stops, and so does the other
 * team's prep time; this team's runs, from what is left of its bank. Called
 * by the team whose prep time runs, it pauses. Past the bank it counts on
 * into overtime (see `prepClocks`): time-up is signalled like any clock's,
 * and the teacher decides when it ends.
 */
function togglePrep(debate: Debate, side: Side, now: number): Debate {
  if (debate.prep.active === side) return pausePrep(debate, now);
  const paused = pausePrep(pauseSteps(debate, now), now);
  const { clocks } = paused.prep;
  return {
    ...paused,
    prep: { clocks: { ...clocks, [side]: startTimer(clocks[side], now) }, active: side },
  };
}

function toggle(timer: Timer, now: number): Timer {
  return isRunning(timer) ? pauseTimer(timer, now) : startTimer(timer, now);
}

function toggleTimer({ debate, step }: OpenDebate, now: number): Debate {
  switch (step.type) {
    case 'speech':
    case 'consultation':
    case 'cross-examination':
    case 'audience-questions': {
      const record = recordFor(debate, step);
      return withRecord(debate, step, { ...record, timer: toggle(record.timer, now) });
    }
    case 'free-round': {
      const round = recordFor(debate, step);
      if (round.active !== null) return withRecord(debate, step, pauseFreeRound(round, now));
      const side = round.lastSide;
      if (side === null) return debate; // nobody has spoken yet: tap a name
      return withRecord(debate, step, {
        ...round,
        active: side,
        clocks: { ...round.clocks, [side]: startTimer(round.clocks[side], now) },
      });
    }
    case 'vote-before':
    case 'vote-after':
      return debate;
  }
}

function bump(list: readonly number[], index: number, delta: number): number[] {
  const next = [...list];
  while (next.length <= index) next.push(0);
  next[index] = Math.max(0, next[index] + delta);
  return next;
}

/**
 * A tap on a name in the free round. That student gets the floor and their
 * team's clock runs; the other clock stops. A switch to the other team counts
 * as a team turn, every tap on a new speaker as a speaker turn. A tap on the
 * student who already has the floor only resumes a paused clock: it does not
 * count again, so a double tap cannot inflate the numbers.
 */
export function tapFreeRound(
  round: FreeRoundRecord,
  side: Side,
  slot: number,
  now: number,
): FreeRoundRecord {
  const isCurrent = round.current?.side === side && round.current.slot === slot;
  if (isCurrent && round.active === side) return round;

  let clocks = round.clocks;
  if (round.active !== null && round.active !== side) {
    clocks = { ...clocks, [round.active]: pauseTimer(clocks[round.active], now) };
  }
  clocks = { ...clocks, [side]: startTimer(clocks[side], now) };

  return {
    ...round,
    clocks,
    active: side,
    lastSide: side,
    current: { side, slot },
    teamTurns:
      round.lastSide === side
        ? round.teamTurns
        : { ...round.teamTurns, [side]: round.teamTurns[side] + 1 },
    speakerTurns: isCurrent
      ? round.speakerTurns
      : { ...round.speakerTurns, [side]: bump(round.speakerTurns[side], slot, 1) },
  };
}

/** Add `slot` to a list of who spoke, at the end, unless it is there already. */
function withSlot(list: readonly number[], slot: number): readonly number[] {
  return list.includes(slot) ? list : [...list, slot];
}

function tapSpeaker({ debate, step }: OpenDebate, side: Side, slot: number, now: number): Debate {
  if (!membersOf(debate.teams, side).some((member) => member.slot === slot)) return debate;
  if (step.type === 'free-round') {
    const round = recordFor(debate, step);
    const next = tapFreeRound(round, side, slot, now);
    return next === round ? debate : withRecord(debate, step, next);
  }
  if (step.type === 'cross-examination') {
    // A student of the asking side asks; one of the other side answers. Either
    // tap starts the clock, as in a speech.
    const record = recordFor(debate, step);
    const timer = startTimer(record.timer, now);
    if (side === step.askingSide) {
      return withRecord(debate, step, {
        ...record,
        timer,
        askers: withSlot(record.askers, slot),
        asker: slot,
      });
    }
    return withRecord(debate, step, {
      ...record,
      timer,
      answerers: withSlot(record.answerers, slot),
      answerer: slot,
    });
  }
  if (step.type !== 'speech' || step.side !== side) return debate;
  const record = recordFor(debate, step);
  return withRecord(debate, step, {
    ...record,
    timer: startTimer(record.timer, now),
    speakers: withSlot(record.speakers, slot),
    current: slot,
  });
}

/**
 * `slot` taken off a list of who spoke; the one who has the floor now is then
 * the last one left. `null` when the slot is not on the list.
 */
function withoutSlot(
  list: readonly number[],
  current: number | null,
  slot: number,
): { readonly list: readonly number[]; readonly current: number | null } | null {
  if (!list.includes(slot)) return null;
  const rest = list.filter((other) => other !== slot);
  return { list: rest, current: current === slot ? (rest.at(-1) ?? null) : current };
}

function removeSpeaker({ debate, step }: OpenDebate, side: Side, slot: number): Debate {
  if (step.type === 'speech') {
    if (side !== step.side) return debate;
    const record = recordFor(debate, step);
    const removed = withoutSlot(record.speakers, record.current, slot);
    if (removed === null) return debate;
    return withRecord(debate, step, {
      ...record,
      speakers: removed.list,
      current: removed.current,
    });
  }
  if (step.type === 'cross-examination') {
    const record = recordFor(debate, step);
    if (side === step.askingSide) {
      const removed = withoutSlot(record.askers, record.asker, slot);
      if (removed === null) return debate;
      return withRecord(debate, step, {
        ...record,
        askers: removed.list,
        asker: removed.current,
      });
    }
    if (side !== otherSide(step.askingSide)) return debate;
    const removed = withoutSlot(record.answerers, record.answerer, slot);
    if (removed === null) return debate;
    return withRecord(debate, step, {
      ...record,
      answerers: removed.list,
      answerer: removed.current,
    });
  }
  return debate;
}

/** Answers to the audience, per team: counted up, or corrected down to no less than 0. */
function adjustAnswers({ debate, step }: OpenDebate, side: Side, delta: number): Debate {
  if (step.type !== 'audience-questions' || !Number.isInteger(delta) || delta === 0) return debate;
  const record = recordFor(debate, step);
  const count = Math.max(0, record.answers[side] + delta);
  if (count === record.answers[side]) return debate;
  return withRecord(debate, step, { ...record, answers: { ...record.answers, [side]: count } });
}

function adjustFreeTurns(
  { debate, step }: OpenDebate,
  side: Side,
  slot: number,
  delta: number,
): Debate {
  if (step.type !== 'free-round' || !isSlot(slot, LIMITS.teamSize.max)) return debate;
  if (!Number.isInteger(delta) || delta === 0) return debate;
  const round = recordFor(debate, step);
  return withRecord(debate, step, {
    ...round,
    speakerTurns: { ...round.speakerTurns, [side]: bump(round.speakerTurns[side], slot, delta) },
  });
}

function setVotes({ debate, step }: OpenDebate, side: Side, value: number): Debate {
  if (step.type !== 'vote-before' && step.type !== 'vote-after') return debate;
  const record = recordFor(debate, step);
  return withRecord(debate, step, {
    ...record,
    votes: { ...record.votes, [side]: clampVotes(value) },
  });
}
