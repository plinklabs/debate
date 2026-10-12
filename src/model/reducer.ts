// The app state and the reducer that changes it. Time only enters through the
// `now` of an action (milliseconds on a monotonic clock), so a whole debate can
// be replayed in a test with a fake clock.

import { LIMITS, nextId, type DebateConfig, type Side, type Step, type Topic } from './config';
import {
  MAX_NAME_LENGTH,
  debateRunning,
  emptySession,
  isPlayable,
  membersOf,
  newDebate,
  pauseDebate,
  pauseFreeRound,
  pauseSession,
  recordFor,
  stepIndexOf,
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
  | { readonly type: 'remove-speaker'; readonly slot: number }
  | {
      readonly type: 'adjust-free-turns';
      readonly side: Side;
      readonly slot: number;
      readonly delta: number;
    }
  | { readonly type: 'clear-step' }
  | { readonly type: 'set-votes'; readonly side: Side; readonly value: number }
  /** Forget every debate, name and result; keep the setup. */
  | { readonly type: 'reset-session' };

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
      if (!isSlot(action.slot, state.config.format.teamSize.max)) return state;
      return updateDebate(state, action.debateId, (debate) =>
        setName(debate, action.side, action.slot, action.name),
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
      return updateOpen(state, (open) => toggleTimer(open, action.now));
    case 'tap-speaker':
      return updateOpen(state, (open) => tapSpeaker(open, action.side, action.slot, action.now));
    case 'remove-speaker':
      return updateOpen(state, (open) => removeSpeaker(open, action.slot));
    case 'adjust-free-turns':
      return updateOpen(state, (open) =>
        adjustFreeTurns(open, action.side, action.slot, action.delta),
      );
    case 'clear-step':
      return updateOpen(state, (open) => withoutRecord(open.debate, open.step));
    case 'set-votes':
      return updateOpen(state, (open) => setVotes(open, action.side, action.value));
    case 'reset-session':
      return withSession(state, emptySession());
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
  // Leaving a step stops its clock. Entering one never starts it.
  return { ...pauseDebate(open.debate, now), step: target };
}

function toggle(timer: Timer, now: number): Timer {
  return isRunning(timer) ? pauseTimer(timer, now) : startTimer(timer, now);
}

function toggleTimer({ debate, step }: OpenDebate, now: number): Debate {
  switch (step.type) {
    case 'speech':
    case 'consultation': {
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

function tapSpeaker({ debate, step }: OpenDebate, side: Side, slot: number, now: number): Debate {
  if (!membersOf(debate.teams, side).some((member) => member.slot === slot)) return debate;
  if (step.type === 'free-round') {
    const round = recordFor(debate, step);
    const next = tapFreeRound(round, side, slot, now);
    return next === round ? debate : withRecord(debate, step, next);
  }
  if (step.type !== 'speech' || step.side !== side) return debate;
  const record = recordFor(debate, step);
  return withRecord(debate, step, {
    ...record,
    timer: startTimer(record.timer, now),
    speakers: record.speakers.includes(slot) ? record.speakers : [...record.speakers, slot],
    current: slot,
  });
}

function removeSpeaker({ debate, step }: OpenDebate, slot: number): Debate {
  if (step.type !== 'speech') return debate;
  const record = recordFor(debate, step);
  if (!record.speakers.includes(slot)) return debate;
  const speakers = record.speakers.filter((speaker) => speaker !== slot);
  const current = record.current === slot ? (speakers.at(-1) ?? null) : record.current;
  return withRecord(debate, step, { ...record, speakers, current });
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
