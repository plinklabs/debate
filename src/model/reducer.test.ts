// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SIDES, type DebateConfig, type Side, type Step } from './config';
import { GRAFFITI_PRESET } from './presets';
import {
  anyRunning,
  currentDebate,
  freeze,
  initialState,
  reducer,
  type Action,
  type AppState,
} from './reducer';
import {
  isPlayable,
  recordFor,
  shiftOf,
  turnsOf,
  type Debate,
  type FreeRoundRecord,
  type SpeechRecord,
} from './session';
import { elapsedMs, isRunning, timingOf } from './timer';

const config = GRAFFITI_PRESET.build('nl');
const { format } = config;

/** The fake clock: seconds into the lesson, as the milliseconds `now` the reducer takes. */
const at = (seconds: number) => seconds * 1000;

function apply(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

function stepById(id: string, steps: readonly Step[] = format.steps): Step {
  const step = steps.find((candidate) => candidate.id === id);
  if (step === undefined) throw new Error(`no step ${id}`);
  return step;
}

function debateOf(state: AppState, id = 'd1'): Debate {
  const debate = state.session.debates.find((candidate) => candidate.id === id);
  if (debate === undefined) throw new Error(`no debate ${id}`);
  return debate;
}

function speech(state: AppState, stepId: string, debateId = 'd1'): SpeechRecord {
  const record = recordFor(debateOf(state, debateId), stepById(stepId));
  if (record.type !== 'speech') throw new Error(`${stepId} is not a speech`);
  return record;
}

function freeRound(state: AppState): FreeRoundRecord {
  const record = recordFor(debateOf(state), stepById('free-round'));
  if (record.type !== 'free-round') throw new Error('not a free round');
  return record;
}

function names(debateId: string, teams: Record<Side, string[]>): Action[] {
  return SIDES.flatMap((side) =>
    teams[side].map((name, slot) => ({ type: 'set-name', debateId, side, slot, name }) as const),
  );
}

/** A graffiti session with one debate on the first topic and two complete teams. */
function withTeams(base: DebateConfig = config): AppState {
  return apply(
    initialState(base),
    { type: 'add-debate', topicId: 't1' },
    ...names('d1', { pro: ['Ann', 'Bert', 'Cas'], con: ['Dirk', 'Eva'] }),
  );
}

describe('a full graffiti debate on a fake clock', () => {
  it('records the timings, speakers, chess clock and vote shift', () => {
    const visited: string[] = [];
    const visit = (state: AppState) => {
      visited.push(currentDebate(state)?.step.id ?? 'closed');
      return state;
    };

    let s = apply(withTeams(), { type: 'open-debate', debateId: 'd1', now: at(0) });
    expect(currentDebate(s)?.topic?.text).toBe(config.topics[0].text);

    // Vote before: 10 for, 15 against.
    s = visit(apply(s, { type: 'set-votes', side: 'pro', value: 10 }));
    s = apply(s, { type: 'set-votes', side: 'con', value: 15 });

    // Opening for: tapping a name starts the clock; the team uses its full minute.
    s = visit(apply(s, { type: 'next-step', now: at(1) }));
    s = apply(s, { type: 'tap-speaker', side: 'pro', slot: 0, now: at(2) });
    s = apply(s, { type: 'tap-speaker', side: 'pro', slot: 1, now: at(30) });
    expect(elapsedMs(speech(s, 'opening-pro').timer, at(45))).toBe(43_000);
    s = apply(s, { type: 'toggle-timer', now: at(62) });

    // Opening against: moving on stops the clock, 5 seconds early.
    s = visit(apply(s, { type: 'next-step', now: at(63) }));
    s = apply(s, { type: 'tap-speaker', side: 'con', slot: 0, now: at(70) });
    s = apply(s, { type: 'next-step', now: at(125) });

    // Short consultation, started and stopped by hand.
    s = visit(s);
    s = apply(s, { type: 'toggle-timer', now: at(130) }, { type: 'toggle-timer', now: at(190) });

    // Rebuttal for: 10 seconds over time.
    s = visit(apply(s, { type: 'next-step', now: at(191) }));
    s = apply(s, { type: 'tap-speaker', side: 'pro', slot: 2, now: at(200) });
    s = apply(s, { type: 'next-step', now: at(300) });

    // Rebuttal against: exactly on time.
    s = visit(s);
    s = apply(s, { type: 'tap-speaker', side: 'con', slot: 1, now: at(310) });
    s = apply(s, { type: 'toggle-timer', now: at(400) });

    // Free round: a chess clock, 90 seconds on each team's clock.
    s = visit(apply(s, { type: 'next-step', now: at(401) }));
    const idle = apply(s, { type: 'toggle-timer', now: at(410) });
    expect(idle).toBe(s); // nobody has the floor yet, so there is no clock to start
    s = apply(s, { type: 'tap-speaker', side: 'pro', slot: 0, now: at(500) });
    expect(elapsedMs(freeRound(s).clocks.pro, at(515))).toBe(15_000);
    s = apply(s, { type: 'tap-speaker', side: 'con', slot: 0, now: at(520) });
    s = apply(s, { type: 'tap-speaker', side: 'con', slot: 1, now: at(530) });
    const doubleTap = apply(s, { type: 'tap-speaker', side: 'con', slot: 1, now: at(531) });
    expect(doubleTap).toBe(s);
    s = apply(s, { type: 'toggle-timer', now: at(540) });
    expect(freeRound(s).active).toBeNull();
    s = apply(s, { type: 'toggle-timer', now: at(600) }); // resumes against
    expect(freeRound(s).active).toBe('con');
    s = apply(s, { type: 'tap-speaker', side: 'pro', slot: 1, now: at(610) });
    s = apply(s, { type: 'next-step', now: at(720) });

    // Closing statements: against first, then for.
    s = visit(s);
    s = apply(s, { type: 'tap-speaker', side: 'con', slot: 0, now: at(730) });
    s = apply(s, { type: 'toggle-timer', now: at(760) });
    s = visit(apply(s, { type: 'next-step', now: at(761) }));
    s = apply(s, { type: 'tap-speaker', side: 'pro', slot: 0, now: at(770) });
    s = apply(s, { type: 'next-step', now: at(805) });

    // Vote after: 18 for, 7 against.
    s = visit(s);
    s = apply(s, { type: 'set-votes', side: 'pro', value: 18 });
    s = apply(s, { type: 'set-votes', side: 'con', value: 7 });
    s = apply(s, { type: 'finish-debate', now: at(810) });

    expect(visited).toEqual(format.steps.map((step) => step.id));
    expect(s.session.current).toBeNull();
    expect(anyRunning(s)).toBe(false);
    const debate = debateOf(s);
    expect(debate.done).toBe(true);

    const later = at(9999); // nothing runs any more, so the time of reading does not matter
    const timing = (id: string) => {
      const step = stepById(id);
      const record = recordFor(debate, step);
      if (step.type !== 'speech' || record.type !== 'speech') {
        throw new Error(`${id} is not a speech`);
      }
      return { ...timingOf(step.seconds, elapsedMs(record.timer, later)), who: record.speakers };
    };
    expect(timing('opening-pro')).toEqual({
      planned: 60,
      used: 60,
      rest: 0,
      overtime: 0,
      who: [0, 1],
    });
    expect(timing('opening-con')).toEqual({
      planned: 60,
      used: 55,
      rest: 5,
      overtime: 0,
      who: [0],
    });
    expect(timing('rebuttal-pro')).toEqual({
      planned: 90,
      used: 100,
      rest: 0,
      overtime: 10,
      who: [2],
    });
    expect(timing('rebuttal-con')).toEqual({
      planned: 90,
      used: 90,
      rest: 0,
      overtime: 0,
      who: [1],
    });
    expect(timing('closing-con')).toEqual({
      planned: 30,
      used: 30,
      rest: 0,
      overtime: 0,
      who: [0],
    });
    expect(timing('closing-pro')).toEqual({
      planned: 30,
      used: 35,
      rest: 0,
      overtime: 5,
      who: [0],
    });

    const consultation = recordFor(debate, stepById('consultation'));
    expect(consultation.type === 'consultation' && elapsedMs(consultation.timer, later)).toBe(
      60_000,
    );

    const round = recordFor(debate, stepById('free-round'));
    if (round.type !== 'free-round') throw new Error('not a free round');
    expect(timingOf(90, elapsedMs(round.clocks.pro, later))).toEqual({
      planned: 90,
      used: 130,
      rest: 0,
      overtime: 40,
    });
    expect(timingOf(90, elapsedMs(round.clocks.con, later))).toEqual({
      planned: 90,
      used: 30,
      rest: 60,
      overtime: 0,
    });
    expect(round.teamTurns).toEqual({ pro: 2, con: 1 });
    expect(round.speakerTurns).toEqual({ pro: [1, 1], con: [1, 1] });

    expect(
      SIDES.map((side) => [0, 1, 2].map((slot) => turnsOf(format, debate, side, slot))),
    ).toEqual([
      [3, 2, 1],
      [3, 2, 0],
    ]);

    const shift = shiftOf(format, debate);
    expect(shift?.absolute).toBe(8);
    expect(shift?.shareBefore).toBeCloseTo(0.4);
    expect(shift?.shareAfter).toBeCloseTo(0.72);
    expect(shift?.pp).toBeCloseTo(32);
  });
});

describe('debates and teams', () => {
  it('numbers new debates and lets several groups debate one topic', () => {
    const s = apply(
      initialState(config),
      { type: 'add-debate', topicId: 't1' },
      { type: 'add-debate', topicId: 't1' },
      { type: 'add-debate', topicId: 't3' },
    );
    expect(s.session.debates.map((debate) => [debate.id, debate.topicId])).toEqual([
      ['d1', 't1'],
      ['d2', 't1'],
      ['d3', 't3'],
    ]);
    expect(debateOf(s).teams).toEqual({ pro: ['', '', ''], con: ['', '', ''] });
  });

  it('ignores a debate on a topic that does not exist', () => {
    const s = initialState(config);
    expect(reducer(s, { type: 'add-debate', topicId: 't9' })).toBe(s);
  });

  it('removes a debate, and closes it when it was open', () => {
    let s = apply(withTeams(), { type: 'open-debate', debateId: 'd1', now: at(0) });
    s = reducer(s, { type: 'remove-debate', debateId: 'd1' });
    expect(s.session).toEqual({ debates: [], current: null });
  });

  it('keeps names within the slots of the format', () => {
    let s = apply(initialState(config), { type: 'add-debate', topicId: 't1' });
    const before = s;
    s = reducer(s, { type: 'set-name', debateId: 'd1', side: 'pro', slot: 3, name: 'Fien' });
    s = reducer(s, { type: 'set-name', debateId: 'd1', side: 'pro', slot: -1, name: 'Fien' });
    s = reducer(s, { type: 'set-name', debateId: 'd9', side: 'pro', slot: 0, name: 'Fien' });
    expect(s).toBe(before);

    s = reducer(s, {
      type: 'set-name',
      debateId: 'd1',
      side: 'con',
      slot: 2,
      name: 'x'.repeat(50),
    });
    expect(debateOf(s).teams.con[2]).toHaveLength(40);
  });

  it('starts a debate only when both teams are complete', () => {
    const open: Action = { type: 'open-debate', debateId: 'd1', now: at(0) };
    let s = apply(
      initialState(config),
      { type: 'add-debate', topicId: 't1' },
      ...names('d1', { pro: ['Ann', 'Bert'], con: ['Dirk', '  '] }),
    );
    expect(isPlayable(format, debateOf(s))).toBe(false);
    expect(reducer(s, open)).toBe(s);

    s = reducer(s, { type: 'set-name', debateId: 'd1', side: 'con', slot: 1, name: 'Eva' });
    expect(isPlayable(format, debateOf(s))).toBe(true);
    expect(reducer(s, open).session.current).toBe('d1');
  });

  it('runs one debate at a time: opening another stops every clock', () => {
    let s = apply(
      withTeams(),
      { type: 'add-debate', topicId: 't2' },
      ...names('d2', { pro: ['Fien', 'Gert'], con: ['Hans', 'Ines'] }),
      { type: 'open-debate', debateId: 'd1', now: at(0) },
      { type: 'next-step', now: at(1) },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: at(2) },
    );
    expect(anyRunning(s)).toBe(true);
    s = reducer(s, { type: 'open-debate', debateId: 'd2', now: at(12) });
    expect(anyRunning(s)).toBe(false);
    expect(speech(s, 'opening-pro').timer).toEqual({ accMs: 10_000, since: null });
    expect(currentDebate(s)?.debate.id).toBe('d2');
  });

  it('forgets the session but keeps the setup on reset', () => {
    const s = apply(withTeams(), { type: 'reset-session' });
    expect(s).toEqual(initialState(config));
  });
});

describe('stepping through a debate', () => {
  const open = () => apply(withTeams(), { type: 'open-debate', debateId: 'd1', now: at(0) });

  it('ignores step actions when no debate is open', () => {
    const s = withTeams();
    for (const action of [
      { type: 'next-step', now: at(1) },
      { type: 'toggle-timer', now: at(1) },
      { type: 'set-votes', side: 'pro', value: 3 },
      { type: 'finish-debate', now: at(1) },
      { type: 'close-debate', now: at(1) },
    ] as const) {
      expect(reducer(s, action)).toBe(s);
    }
  });

  it('stops the clock when leaving a step and never starts one when entering', () => {
    let s = apply(
      open(),
      { type: 'next-step', now: at(1) },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: at(2) },
      { type: 'go-to-step', step: 3, now: at(12) },
    );
    expect(currentDebate(s)?.step.id).toBe('consultation');
    expect(anyRunning(s)).toBe(false);
    s = apply(s, { type: 'previous-step', now: at(20) }, { type: 'previous-step', now: at(21) });
    expect(currentDebate(s)?.step.id).toBe('opening-pro');
    expect(speech(s, 'opening-pro').timer).toEqual({ accMs: 10_000, since: null });
  });

  it('stays within the steps of the format', () => {
    const s = open();
    expect(reducer(s, { type: 'previous-step', now: at(1) })).toBe(s);
    expect(reducer(s, { type: 'go-to-step', step: 10, now: at(1) })).toBe(s);
    expect(reducer(s, { type: 'go-to-step', step: 1.5, now: at(1) })).toBe(s);
    const last = reducer(s, { type: 'go-to-step', step: 9, now: at(1) });
    expect(reducer(last, { type: 'next-step', now: at(2) })).toBe(last);
  });

  it('takes speakers of the speaking side only, and only filled-in names', () => {
    const s = apply(open(), { type: 'next-step', now: at(1) });
    expect(reducer(s, { type: 'tap-speaker', side: 'con', slot: 0, now: at(2) })).toBe(s);
    const emptySlot = apply(
      s,
      { type: 'set-name', debateId: 'd1', side: 'pro', slot: 2, name: '' },
      { type: 'tap-speaker', side: 'pro', slot: 2, now: at(2) },
    );
    expect(speech(emptySlot, 'opening-pro').speakers).toEqual([]);
  });

  it('removes a speaker and hands the floor to the one before', () => {
    let s = apply(
      open(),
      { type: 'next-step', now: at(1) },
      { type: 'tap-speaker', side: 'pro', slot: 2, now: at(2) },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: at(3) },
      { type: 'tap-speaker', side: 'pro', slot: 2, now: at(4) },
    );
    expect(speech(s, 'opening-pro')).toMatchObject({ speakers: [2, 0], current: 2 });
    s = reducer(s, { type: 'remove-speaker', slot: 2 });
    expect(speech(s, 'opening-pro')).toMatchObject({ speakers: [0], current: 0 });
    s = reducer(s, { type: 'remove-speaker', slot: 0 });
    expect(speech(s, 'opening-pro')).toMatchObject({ speakers: [], current: null });
    expect(reducer(s, { type: 'remove-speaker', slot: 0 })).toBe(s);
  });

  it('corrects free-round turns without going below zero', () => {
    let s = apply(
      open(),
      { type: 'go-to-step', step: 6, now: at(1) },
      { type: 'tap-speaker', side: 'con', slot: 1, now: at(2) },
      { type: 'adjust-free-turns', side: 'con', slot: 1, delta: -1 },
      { type: 'adjust-free-turns', side: 'con', slot: 1, delta: -1 },
      { type: 'adjust-free-turns', side: 'pro', slot: 2, delta: 1 },
    );
    expect(freeRound(s).speakerTurns).toEqual({ pro: [0, 0, 1], con: [0, 0] });
    s = reducer(s, { type: 'adjust-free-turns', side: 'pro', slot: 99, delta: 1 });
    expect(freeRound(s).speakerTurns.pro).toEqual([0, 0, 1]);
  });

  it('a tap on the student who has the floor resumes the clock without counting a turn', () => {
    const s = apply(
      open(),
      { type: 'go-to-step', step: 6, now: at(1) },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: at(2) },
      { type: 'toggle-timer', now: at(5) },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: at(10) },
    );
    expect(freeRound(s)).toMatchObject({
      active: 'pro',
      teamTurns: { pro: 1, con: 0 },
      speakerTurns: { pro: [1], con: [] },
    });
    expect(elapsedMs(freeRound(s).clocks.pro, at(11))).toBe(4000);
  });

  it('clears only the current step', () => {
    let s = apply(
      open(),
      { type: 'set-votes', side: 'pro', value: 4 },
      { type: 'next-step', now: at(1) },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: at(2) },
      { type: 'clear-step' },
    );
    expect(speech(s, 'opening-pro')).toEqual({
      type: 'speech',
      timer: { accMs: 0, since: null },
      speakers: [],
      current: null,
    });
    s = reducer(s, { type: 'go-to-step', step: 0, now: at(3) });
    const before = recordFor(debateOf(s), stepById('vote-before'));
    expect(before.type === 'vote-before' && before.votes).toEqual({ pro: 4, con: 0 });
  });

  it('keeps vote counts whole and within range, and only on a vote step', () => {
    let s = open();
    s = apply(s, { type: 'set-votes', side: 'pro', value: -3 });
    s = apply(s, { type: 'set-votes', side: 'con', value: 2.6 });
    const record = recordFor(debateOf(s), stepById('vote-before'));
    expect(record.type === 'vote-before' && record.votes).toEqual({ pro: 0, con: 3 });

    const onSpeech = apply(s, { type: 'next-step', now: at(1) });
    expect(reducer(onSpeech, { type: 'set-votes', side: 'pro', value: 5 })).toBe(onSpeech);
  });

  it('pauses the debate when it is closed and keeps its step', () => {
    const s = apply(
      open(),
      { type: 'next-step', now: at(1) },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: at(2) },
      { type: 'close-debate', now: at(7) },
    );
    expect(s.session.current).toBeNull();
    expect(anyRunning(s)).toBe(false);
    expect(debateOf(s)).toMatchObject({ step: 1, done: false });
    expect(speech(s, 'opening-pro').timer).toEqual({ accMs: 5000, since: null });
  });
});

describe('changing the setup', () => {
  const running = () =>
    apply(
      withTeams(),
      { type: 'open-debate', debateId: 'd1', now: at(0) },
      { type: 'next-step', now: at(1) },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: at(2) },
    );

  it('stops every clock and keeps results by step id when the steps are reordered', () => {
    const reordered: DebateConfig = {
      ...config,
      format: { ...format, steps: [...format.steps].reverse() },
    };
    const s = reducer(running(), { type: 'set-config', config: reordered, now: at(32) });
    expect(anyRunning(s)).toBe(false);
    expect(s.config).toBe(reordered);
    const record = recordFor(debateOf(s), stepById('opening-pro', reordered.format.steps));
    expect(record).toMatchObject({ speakers: [0], timer: { accMs: 30_000, since: null } });
  });

  it('starts a step whose type changed with an empty record', () => {
    const steps = format.steps.map((step): Step =>
      step.id === 'opening-pro'
        ? { id: step.id, label: step.label, type: 'consultation', seconds: 60 }
        : step,
    );
    const s = reducer(running(), {
      type: 'set-config',
      config: { ...config, format: { ...format, steps } },
      now: at(10),
    });
    expect(recordFor(debateOf(s), stepById('opening-pro', steps))).toEqual({
      type: 'consultation',
      timer: { accMs: 0, since: null },
    });
  });

  it('keeps the current step within a shorter format', () => {
    let s = apply(running(), { type: 'go-to-step', step: 9, now: at(5) });
    s = reducer(s, {
      type: 'set-config',
      config: { ...config, format: { ...format, steps: format.steps.slice(0, 3) } },
      now: at(6),
    });
    expect(currentDebate(s)).toMatchObject({ stepIndex: 2, step: { id: 'opening-con' } });
    s = reducer(s, { type: 'previous-step', now: at(7) });
    expect(currentDebate(s)?.step.id).toBe('opening-pro');
  });

  it('has no vote shift in a format without both votes', () => {
    const steps = format.steps.filter((step) => step.type !== 'vote-after');
    expect(shiftOf({ ...format, steps }, debateOf(withTeams()))).toBeNull();
  });
});

describe('freeze', () => {
  it('pauses every running timer at its elapsed time', () => {
    const s = apply(
      withTeams(),
      { type: 'open-debate', debateId: 'd1', now: at(0) },
      { type: 'go-to-step', step: 6, now: at(1) },
      { type: 'tap-speaker', side: 'con', slot: 0, now: at(2) },
    );
    const frozen = freeze(s, at(9));
    expect(anyRunning(frozen)).toBe(false);
    expect(freeRound(frozen)).toMatchObject({
      active: null,
      lastSide: 'con',
      clocks: { con: { accMs: 7000, since: null } },
    });
    expect(frozen.session.current).toBe('d1');
    expect(freeze(frozen, at(20))).toBe(frozen);
    expect(isRunning(freeRound(s).clocks.con)).toBe(true); // the original is untouched
  });
});

describe('records', () => {
  it('never mistakes a property of Object for a stored record', () => {
    const step: Step = { id: 'constructor', type: 'consultation', label: '', seconds: 60 };
    expect(recordFor(debateOf(withTeams()), step)).toEqual({
      type: 'consultation',
      timer: { accMs: 0, since: null },
    });
  });
});
