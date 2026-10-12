// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SIDES, type DebateConfig, type Side, type Step } from './config';
import { GRAFFITI_PRESET, KARL_POPPER_PRESET, PUBLIC_DEBATE_PRESET } from './presets';
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
  debateRunning,
  hasResults,
  isPlayable,
  prepClocks,
  recordFor,
  shiftOf,
  turnsOf,
  type AudienceQuestionsRecord,
  type CrossExaminationRecord,
  type Debate,
  type FreeRoundRecord,
  type SpeechRecord,
} from './session';
import { countdown, elapsedMs, formatCountdown, isRunning, timingOf } from './timer';

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

  it('lets a name left beyond a smaller team size be cleared', () => {
    let s = withTeams();
    s = reducer(s, {
      type: 'set-config',
      config: { ...config, format: { ...format, teamSize: { min: 2, max: 2 } } },
      now: at(0),
    });
    // Ann, Bert and Cas are one too many now.
    expect(isPlayable(s.config.format, debateOf(s))).toBe(false);

    s = reducer(s, { type: 'set-name', debateId: 'd1', side: 'pro', slot: 2, name: '' });
    expect(debateOf(s).teams.pro).toEqual(['Ann', 'Bert', '']);
    expect(isPlayable(s.config.format, debateOf(s))).toBe(true);

    // A slot the team never had stays out of reach.
    const before = s;
    s = reducer(s, { type: 'set-name', debateId: 'd1', side: 'pro', slot: 3, name: 'Fien' });
    expect(s).toBe(before);
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

  it('replaces the setup and the session with a loaded state', () => {
    const other = GRAFFITI_PRESET.build('en');
    const loaded: AppState = {
      config: other,
      session: {
        debates: withTeams().session.debates.map((d) => ({ ...d, done: true })),
        current: null,
      },
    };
    const running = apply(withTeams(), { type: 'open-debate', debateId: 'd1', now: at(0) });
    const s = reducer(running, { type: 'load-state', state: loaded });
    expect(s).toEqual(loaded);
    expect(anyRunning(s)).toBe(false);
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
    s = reducer(s, { type: 'remove-speaker', side: 'pro', slot: 2 });
    expect(speech(s, 'opening-pro')).toMatchObject({ speakers: [0], current: 0 });
    s = reducer(s, { type: 'remove-speaker', side: 'pro', slot: 0 });
    expect(speech(s, 'opening-pro')).toMatchObject({ speakers: [], current: null });
    expect(reducer(s, { type: 'remove-speaker', side: 'pro', slot: 0 })).toBe(s);
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

// ---------------------------------------------------------------------------
// #8: cross-examination, audience questions and the prep-time bank
// ---------------------------------------------------------------------------

const popper = KARL_POPPER_PRESET.build('nl');

/** A Karl Popper debate, three against three, open at `step` (by id) at 0 s. */
function popperAt(stepId: string): AppState {
  return apply(
    initialState(popper),
    { type: 'add-debate', topicId: 't1' },
    ...names('d1', { pro: ['Ann', 'Bert', 'Cas'], con: ['Dirk', 'Eva', 'Fien'] }),
    { type: 'open-debate', debateId: 'd1', now: at(0) },
    {
      type: 'go-to-step',
      step: popper.format.steps.findIndex((step) => step.id === stepId),
      now: at(0),
    },
  );
}

function crossExamination(state: AppState, stepId: string): CrossExaminationRecord {
  const record = recordFor(debateOf(state), stepById(stepId, state.config.format.steps));
  if (record.type !== 'cross-examination') throw new Error(`${stepId} is no cross-examination`);
  return record;
}

function popperSpeech(state: AppState, stepId: string): SpeechRecord {
  const record = recordFor(debateOf(state), stepById(stepId, popper.format.steps));
  if (record.type !== 'speech') throw new Error(`${stepId} is not a speech`);
  return record;
}

/** What a team has left of its bank at `now`, as its clock shows it: `3:00`, or `+0:12` over. */
function bankLeft(state: AppState, side: Side, now: number): string {
  const clock = prepClocks(state.config.format, debateOf(state)).find((c) => c.side === side);
  if (clock === undefined) throw new Error('no prep-time bank');
  return formatCountdown(countdown(clock.seconds, elapsedMs(clock.timer, now)));
}

const prepRuns = (state: AppState) => debateOf(state).prep.active;

describe('prep time', () => {
  it('runs down the bank of the team that calls it, and stops the clock of the step', () => {
    let s = apply(popperAt('cross-examination-con-1'), {
      type: 'tap-speaker',
      side: 'con',
      slot: 0,
      now: at(0),
    });
    expect(isRunning(crossExamination(s, 'cross-examination-con-1').timer)).toBe(true);

    s = reducer(s, { type: 'toggle-prep', side: 'con', now: at(30) });
    expect(prepRuns(s)).toBe('con');
    expect(crossExamination(s, 'cross-examination-con-1').timer).toEqual({
      accMs: 30_000,
      since: null,
    });
    expect(bankLeft(s, 'con', at(90))).toBe('3:00');
    expect(bankLeft(s, 'pro', at(90))).toBe('4:00');
    expect(hasResults(debateOf(s))).toBe(true);
  });

  it('pauses when the team calls it again, and goes on later from what is left', () => {
    const s = apply(
      popperAt('constructive-pro'),
      { type: 'toggle-prep', side: 'pro', now: at(0) },
      { type: 'toggle-prep', side: 'pro', now: at(50) },
    );
    expect(prepRuns(s)).toBeNull();
    expect(bankLeft(s, 'pro', at(500))).toBe('3:10');
    const later = reducer(s, { type: 'toggle-prep', side: 'pro', now: at(600) });
    expect(bankLeft(later, 'pro', at(640))).toBe('2:30');
  });

  it('runs for one team at a time: a call by the other team stops the first', () => {
    const s = apply(
      popperAt('constructive-pro'),
      { type: 'toggle-prep', side: 'pro', now: at(0) },
      { type: 'toggle-prep', side: 'con', now: at(20) },
    );
    expect(prepRuns(s)).toBe('con');
    expect(debateOf(s).prep.clocks.pro).toEqual({ accMs: 20_000, since: null });
    expect(bankLeft(s, 'pro', at(100))).toBe('3:40');
    expect(bankLeft(s, 'con', at(100))).toBe('2:40');
  });

  it('ends when the teacher goes on with the step, with Start or a tap on a name', () => {
    const started = apply(
      popperAt('constructive-con'),
      { type: 'toggle-prep', side: 'con', now: at(0) },
      { type: 'toggle-timer', now: at(15) },
    );
    expect(prepRuns(started)).toBeNull();
    expect(bankLeft(started, 'con', at(100))).toBe('3:45');
    expect(isRunning(popperSpeech(started, 'constructive-con').timer)).toBe(true);

    const tapped = apply(
      popperAt('constructive-con'),
      { type: 'toggle-prep', side: 'pro', now: at(0) },
      { type: 'tap-speaker', side: 'con', slot: 1, now: at(5) },
    );
    expect(prepRuns(tapped)).toBeNull();
    expect(popperSpeech(tapped, 'constructive-con').speakers).toEqual([1]);
  });

  it('is not ended by Start on a step without a clock to start', () => {
    const s = apply(
      initialState(setBank(PUBLIC_DEBATE_PRESET.build('en'), 60)),
      { type: 'add-debate', topicId: 't1' },
      ...names('d1', { pro: ['Ann', 'Bert'], con: ['Dirk', 'Eva'] }),
      { type: 'open-debate', debateId: 'd1', now: at(0) },
      { type: 'toggle-prep', side: 'pro', now: at(0) },
      { type: 'toggle-timer', now: at(5) }, // the vote before has no clock
    );
    expect(prepRuns(s)).toBe('pro');
  });

  it('goes on from one step to the next: it belongs to no step', () => {
    const s = apply(
      popperAt('constructive-pro'),
      { type: 'toggle-prep', side: 'con', now: at(0) },
      { type: 'next-step', now: at(10) },
      { type: 'go-to-step', step: 5, now: at(20) },
      { type: 'previous-step', now: at(30) },
    );
    expect(prepRuns(s)).toBe('con');
    expect(bankLeft(s, 'con', at(40))).toBe('3:20');
  });

  it('counts on into overtime when a bank runs out, until the teacher stops it', () => {
    let s = apply(popperAt('rebuttal-pro'), { type: 'toggle-prep', side: 'pro', now: at(0) });
    expect(bankLeft(s, 'pro', at(239.5))).toBe('0:01');
    expect(bankLeft(s, 'pro', at(240))).toBe('0:00');
    // Past the bank nothing stops by itself: the time-up signal is the screen's
    // (as for any clock), the decision the teacher's.
    expect(bankLeft(s, 'pro', at(252))).toBe('+0:12');
    expect(countdown(240, at(252))).toEqual({ over: true, seconds: 12 });
    expect(prepRuns(s)).toBe('pro');
    expect(debateRunning(debateOf(s))).toBe(true);

    s = reducer(s, { type: 'toggle-prep', side: 'pro', now: at(252) });
    expect(bankLeft(s, 'pro', at(400))).toBe('+0:12');
    expect(timingOf(240, elapsedMs(debateOf(s).prep.clocks.pro, at(400)))).toEqual({
      planned: 240,
      used: 252,
      rest: 0,
      overtime: 12,
    });
    // A team whose bank is used up can still call more; it all counts as overtime.
    s = reducer(s, { type: 'toggle-prep', side: 'pro', now: at(400) });
    expect(bankLeft(s, 'pro', at(410))).toBe('+0:22');
  });

  it('cannot be called in a format without a bank', () => {
    const s = apply(withTeams(), { type: 'open-debate', debateId: 'd1', now: at(0) });
    expect(reducer(s, { type: 'toggle-prep', side: 'pro', now: at(1) })).toBe(s);
    expect(prepClocks(format, debateOf(s))).toEqual([]);
  });

  it('stops when the debate is closed, finished or stored, and when another opens', () => {
    const s = apply(popperAt('constructive-pro'), {
      type: 'toggle-prep',
      side: 'con',
      now: at(0),
    });
    for (const action of [
      { type: 'close-debate', now: at(10) },
      { type: 'finish-debate', now: at(10) },
      { type: 'set-config', config: popper, now: at(10) },
    ] as const) {
      const after = reducer(s, action);
      expect(prepRuns(after)).toBeNull();
      expect(debateOf(after).prep.clocks.con).toEqual({ accMs: 10_000, since: null });
    }
    const frozen = freeze(s, at(10));
    expect(anyRunning(frozen)).toBe(false);
    expect(debateOf(frozen).prep.clocks.con).toEqual({ accMs: 10_000, since: null });

    const other = apply(
      s,
      { type: 'add-debate', topicId: 't1' },
      ...names('d2', { pro: ['Gert', 'Hanne', 'Ilse'], con: ['Jan', 'Kim', 'Lot'] }),
      { type: 'open-debate', debateId: 'd2', now: at(10) },
    );
    expect(prepRuns(other)).toBeNull();
  });

  it('is kept apart from the steps: clearing a step leaves it alone', () => {
    const s = apply(
      popperAt('constructive-pro'),
      { type: 'toggle-prep', side: 'con', now: at(0) },
      { type: 'toggle-prep', side: 'con', now: at(30) },
      { type: 'clear-step' },
    );
    expect(debateOf(s).prep.clocks.con.accMs).toBe(30_000);
  });
});

/** The format with a prep-time bank of this many seconds per team. */
function setBank(base: DebateConfig, secondsPerTeam: number): DebateConfig {
  return { ...base, format: { ...base.format, prepTime: { secondsPerTeam } } };
}

describe('a cross-examination', () => {
  it('records who asks and who answers, and either tap starts the clock', () => {
    let s = popperAt('cross-examination-con-1');
    s = reducer(s, { type: 'tap-speaker', side: 'pro', slot: 0, now: at(2) });
    expect(crossExamination(s, 'cross-examination-con-1')).toEqual({
      type: 'cross-examination',
      timer: { accMs: 0, since: at(2) },
      askers: [],
      answerers: [0],
      asker: null,
      answerer: 0,
    });
    s = apply(
      s,
      { type: 'tap-speaker', side: 'con', slot: 2, now: at(3) },
      { type: 'tap-speaker', side: 'pro', slot: 1, now: at(40) },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: at(50) },
      { type: 'toggle-timer', now: at(62) },
    );
    expect(crossExamination(s, 'cross-examination-con-1')).toEqual({
      type: 'cross-examination',
      timer: { accMs: 60_000, since: null },
      askers: [2],
      answerers: [0, 1],
      asker: 2,
      answerer: 0,
    });
    // Asking counts as a turn for the asker, answering for the one who answered.
    expect(turnsOf(popper.format, debateOf(s), 'con', 2)).toBe(1);
    expect(turnsOf(popper.format, debateOf(s), 'pro', 1)).toBe(1);
    expect(turnsOf(popper.format, debateOf(s), 'con', 0)).toBe(0);
  });

  it('starts and pauses with Start, like a speech', () => {
    const s = apply(
      popperAt('cross-examination-pro-1'),
      { type: 'toggle-timer', now: at(1) },
      { type: 'toggle-timer', now: at(181) },
    );
    expect(crossExamination(s, 'cross-examination-pro-1').timer).toEqual({
      accMs: 180_000,
      since: null,
    });
  });

  it('takes only filled-in names', () => {
    const s = apply(popperAt('cross-examination-pro-1'), {
      type: 'set-name',
      debateId: 'd1',
      side: 'con',
      slot: 2,
      name: '',
    });
    expect(reducer(s, { type: 'tap-speaker', side: 'con', slot: 2, now: at(1) })).toBe(s);
  });

  it('takes back an asker or an answerer, by side', () => {
    let s = apply(
      popperAt('cross-examination-pro-1'),
      { type: 'tap-speaker', side: 'pro', slot: 2, now: at(1) },
      { type: 'tap-speaker', side: 'con', slot: 0, now: at(2) },
      { type: 'tap-speaker', side: 'con', slot: 1, now: at(3) },
    );
    // Slot 0 asked nothing: the slot of the other side is not touched.
    expect(reducer(s, { type: 'remove-speaker', side: 'pro', slot: 0 })).toBe(s);
    s = reducer(s, { type: 'remove-speaker', side: 'con', slot: 1 });
    expect(crossExamination(s, 'cross-examination-pro-1')).toMatchObject({
      askers: [2],
      answerers: [0],
      asker: 2,
      answerer: 0,
    });
    s = reducer(s, { type: 'remove-speaker', side: 'pro', slot: 2 });
    expect(crossExamination(s, 'cross-examination-pro-1')).toMatchObject({
      askers: [],
      asker: null,
    });
  });

  it('is not a speech: a speech takes back only its own side', () => {
    const s = apply(popperAt('constructive-pro'), {
      type: 'tap-speaker',
      side: 'pro',
      slot: 0,
      now: at(1),
    });
    expect(popperSpeech(s, 'constructive-pro').speakers).toEqual([0]);
    expect(reducer(s, { type: 'remove-speaker', side: 'con', slot: 0 })).toBe(s);
  });
});

describe('audience questions', () => {
  function questionsAt(): AppState {
    const config = PUBLIC_DEBATE_PRESET.build('en');
    return apply(
      initialState(config),
      { type: 'add-debate', topicId: 't1' },
      ...names('d1', { pro: ['Ann', 'Bert'], con: ['Dirk', 'Eva'] }),
      { type: 'open-debate', debateId: 'd1', now: at(0) },
      { type: 'go-to-step', step: 3, now: at(0) },
    );
  }

  function questions(state: AppState): AudienceQuestionsRecord {
    const record = recordFor(
      debateOf(state),
      stepById('audience-questions', state.config.format.steps),
    );
    if (record.type !== 'audience-questions') throw new Error('no audience questions');
    return record;
  }

  it('runs one clock, and counts the answers of each team', () => {
    const s = apply(
      questionsAt(),
      { type: 'toggle-timer', now: at(0) },
      { type: 'adjust-answers', side: 'pro', delta: 1 },
      { type: 'adjust-answers', side: 'pro', delta: 1 },
      { type: 'adjust-answers', side: 'con', delta: 1 },
      { type: 'adjust-answers', side: 'pro', delta: -1 },
      { type: 'toggle-timer', now: at(300) },
    );
    expect(questions(s)).toEqual({
      type: 'audience-questions',
      timer: { accMs: 300_000, since: null },
      answers: { pro: 1, con: 1 },
    });
  });

  it('never counts below zero, nor anything but whole steps, nor on another step', () => {
    const s = questionsAt();
    expect(reducer(s, { type: 'adjust-answers', side: 'con', delta: -1 })).toBe(s);
    expect(reducer(s, { type: 'adjust-answers', side: 'con', delta: 0.5 })).toBe(s);
    expect(reducer(s, { type: 'adjust-answers', side: 'con', delta: 0 })).toBe(s);
    const vote = reducer(s, { type: 'go-to-step', step: 0, now: at(1) });
    expect(reducer(vote, { type: 'adjust-answers', side: 'con', delta: 1 })).toBe(vote);
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
