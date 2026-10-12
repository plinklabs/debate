// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GRAFFITI_PRESET } from './presets';
import { initialState, reducer, type Action, type AppState } from './reducer';
import {
  debatedTopicIds,
  hasResults,
  newDebate,
  recordedStepIds,
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
