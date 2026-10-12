// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GRAFFITI_PRESET } from './presets';
import { initialState, reducer, type Action, type AppState } from './reducer';
import {
  clocksOf,
  debatedTopicIds,
  hasResults,
  newDebate,
  recordedStepIds,
  runningClock,
  slotCount,
  type Debate,
} from './session';

const config = GRAFFITI_PRESET.build('en');
const { format } = config;

function apply(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

describe('slotCount', () => {
  it('is the largest team of the format', () => {
    const debate = newDebate('d1', 't1', format);
    expect(slotCount(format, debate.teams, 'pro')).toBe(3);
    expect(slotCount(format, { pro: [], con: [] }, 'con')).toBe(3);
  });

  it('keeps names beyond a team size that went down in view', () => {
    const smaller = { ...format, teamSize: { min: 1, max: 2 } };
    expect(slotCount(smaller, { pro: ['Ann', '', 'Cas'], con: ['Dirk', 'Eva', ' '] }, 'pro')).toBe(
      3,
    );
    expect(slotCount(smaller, { pro: ['Ann', '', 'Cas'], con: ['Dirk', 'Eva', ' '] }, 'con')).toBe(
      2,
    );
  });
});

describe('hasResults', () => {
  it('is false for a debate where nothing was recorded yet', () => {
    const state = apply(
      initialState(config),
      { type: 'add-debate', topicId: 't1' },
      { type: 'set-name', debateId: 'd1', side: 'pro', slot: 0, name: 'Ann' },
    );
    expect(hasResults(state.session.debates[0])).toBe(false);
  });

  it('is true once a step has a record, or once the debate is finished', () => {
    const debate: Debate = newDebate('d1', 't1', format);
    expect(
      hasResults({
        ...debate,
        records: { 'vote-before': { type: 'vote-before', votes: { pro: 3, con: 4 } } },
      }),
    ).toBe(true);
    expect(hasResults({ ...debate, done: true })).toBe(true);
  });
});

describe('ids in use by a session', () => {
  it('lists the topics debated and the steps with results', () => {
    const debate = newDebate('d1', 't2', format);
    const session = {
      current: null,
      debates: [
        {
          ...debate,
          records: {
            'opening-pro': {
              type: 'consultation' as const,
              timer: { accMs: 1000, since: null },
            },
          },
        },
        newDebate('d2', 't4', format),
        newDebate('d3', 't2', format),
      ],
    };
    expect([...debatedTopicIds(session)].sort()).toEqual(['t2', 't4']);
    expect([...recordedStepIds(session)]).toEqual(['opening-pro']);
  });
});

describe('the clocks of a step', () => {
  const step = (id: string) => {
    const found = format.steps.find((candidate) => candidate.id === id);
    if (found === undefined) throw new Error(`no step ${id}`);
    return found;
  };

  /** Debate 1 on the graffiti format, open, with two complete teams. */
  function open(...actions: Action[]): AppState {
    return apply(
      initialState(config),
      { type: 'add-debate', topicId: 't1' },
      { type: 'set-name', debateId: 'd1', side: 'pro', slot: 0, name: 'Ann' },
      { type: 'set-name', debateId: 'd1', side: 'pro', slot: 1, name: 'Bert' },
      { type: 'set-name', debateId: 'd1', side: 'con', slot: 0, name: 'Dirk' },
      { type: 'set-name', debateId: 'd1', side: 'con', slot: 1, name: 'Eva' },
      { type: 'open-debate', debateId: 'd1', now: 0 },
      ...actions,
    );
  }

  it('has one clock for a speech or a consultation and none for a vote', () => {
    const debate = open().session.debates[0];
    expect(clocksOf(debate, step('opening-pro'))).toEqual([
      { side: null, seconds: 60, timer: { accMs: 0, since: null } },
    ]);
    expect(clocksOf(debate, step('consultation'))).toEqual([
      { side: null, seconds: 60, timer: { accMs: 0, since: null } },
    ]);
    expect(clocksOf(debate, step('vote-before'))).toEqual([]);
    expect(clocksOf(debate, step('vote-after'))).toEqual([]);
    expect(runningClock(debate, step('opening-pro'))).toBeNull();
  });

  it('has a clock per team in a free round, of which the one that has the floor runs', () => {
    const goToFreeRound: Action = { type: 'go-to-step', step: 6, now: 1000 };
    const state = open(goToFreeRound, {
      type: 'tap-speaker',
      side: 'con',
      slot: 1,
      now: 2000,
    });
    const debate = state.session.debates[0];
    expect(clocksOf(debate, step('free-round'))).toEqual([
      { side: 'pro', seconds: 90, timer: { accMs: 0, since: null } },
      { side: 'con', seconds: 90, timer: { accMs: 0, since: 2000 } },
    ]);
    expect(runningClock(debate, step('free-round'))).toEqual({
      side: 'con',
      seconds: 90,
      timer: { accMs: 0, since: 2000 },
    });
  });

  it('gives the running clock of a speech', () => {
    const state = open({ type: 'next-step', now: 1000 }, { type: 'toggle-timer', now: 3000 });
    expect(runningClock(state.session.debates[0], step('opening-pro'))?.timer).toEqual({
      accMs: 0,
      since: 3000,
    });
  });
});
