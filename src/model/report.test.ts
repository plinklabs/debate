// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { playedSession } from '../test/playedSession';
import type { DebateConfig, Step } from './config';
import { setTopicText } from './edit';
import { GRAFFITI_PRESET } from './presets';
import { reducer } from './reducer';
import { buildReport, formatHas, stepResult, type DebateResult, type StepResult } from './report';
import { turnsOf } from './session';

const config = GRAFFITI_PRESET.build('en');

function report(state = playedSession()) {
  return buildReport(state.config, state.session, 1_000_000);
}

function first(): DebateResult {
  return report().debates[0];
}

function result<T extends StepResult['type']>(
  debate: DebateResult,
  id: string,
  type: T,
): Extract<StepResult, { type: T }> {
  const found = debate.steps.find((candidate) => candidate.step.id === id);
  if (found?.type !== type) throw new Error(`no ${type} step ${id}`);
  return found as Extract<StepResult, { type: T }>;
}

describe('buildReport', () => {
  it('holds the debates with results, numbered as in the list', () => {
    const { debates, format } = report();
    // Debate 3 has names only.
    expect(debates.map((debate) => [debate.number, debate.id, debate.done])).toEqual([
      [1, 'd1', true],
      [2, 'd2', false],
    ]);
    expect(format).toEqual(config.format);
    expect(debates[0].topic).toEqual(config.topics[0]);
  });

  it('has no debates when nothing was recorded', () => {
    const state = playedSession();
    const fresh = { ...state.session, debates: state.session.debates.slice(2) };
    expect(buildReport(state.config, fresh, 0).debates).toEqual([]);
  });

  it('gives every step of the format, in order', () => {
    expect(first().steps.map((step) => step.step.id)).toEqual(
      config.format.steps.map((step) => step.id),
    );
  });

  it('marks overtime, an early stop, and a clock that never ran', () => {
    const debate = first();
    expect(result(debate, 'opening-pro', 'speech').clock).toEqual({
      side: null,
      planned: 60,
      timing: { planned: 60, used: 72, rest: 0, overtime: 12 },
    });
    expect(result(debate, 'opening-con', 'speech').clock.timing).toEqual({
      planned: 60,
      used: 45,
      rest: 15,
      overtime: 0,
    });
    expect(result(debate, 'consultation', 'consultation').clock).toEqual({
      side: null,
      planned: 60,
      timing: null,
    });
  });

  it('counts a clock that still runs up to now', () => {
    const open = reducer(playedSession(), { type: 'open-debate', debateId: 'd2', now: 0 });
    const running = [
      { type: 'go-to-step', step: 3, now: 0 },
      { type: 'toggle-timer', now: 1_000 },
    ] as const;
    const state = running.reduce(reducer, open);
    const debate = buildReport(state.config, state.session, 31_400).debates[1];
    expect(result(debate, 'consultation', 'consultation').clock.timing?.used).toBe(30);
  });

  it('says who spoke in each speech, by name, in the order they first spoke', () => {
    const debate = first();
    expect(result(debate, 'opening-pro', 'speech').speakers).toEqual([
      { slot: 0, name: 'Ann' },
      { slot: 1, name: 'Bert' },
    ]);
    expect(result(debate, 'opening-con', 'speech').speakers).toEqual([{ slot: 0, name: 'Dirk' }]);
    expect(result(debate, 'rebuttal-pro', 'speech').speakers).toEqual([]);
  });

  it('counts how often each student spoke, as turnsOf does', () => {
    const state = playedSession();
    const debate = first();
    expect(debate.teams.pro).toEqual([
      { slot: 0, name: 'Ann', speeches: 1, freeRoundTurns: 1, turns: 2 },
      { slot: 1, name: 'Bert', speeches: 1, freeRoundTurns: 1, turns: 2 },
    ]);
    expect(debate.teams.con).toEqual([
      { slot: 0, name: 'Dirk', speeches: 1, freeRoundTurns: 0, turns: 1 },
      { slot: 1, name: 'Eva', speeches: 0, freeRoundTurns: 1, turns: 1 },
    ]);
    const [d1] = state.session.debates;
    for (const side of ['pro', 'con'] as const) {
      for (const member of debate.teams[side]) {
        expect(member.turns).toBe(turnsOf(config.format, d1, side, member.slot));
      }
    }
  });

  it('leaves out a speaker whose name was cleared since', () => {
    const state = reducer(playedSession(), {
      type: 'set-name',
      debateId: 'd1',
      side: 'pro',
      slot: 1,
      name: '  ',
    });
    const debate = report(state).debates[0];
    expect(result(debate, 'opening-pro', 'speech').speakers).toEqual([{ slot: 0, name: 'Ann' }]);
    expect(debate.teams.pro.map((member) => member.name)).toEqual(['Ann']);
  });

  it('gives the balance of the free round: time, share and turns per team', () => {
    const round = result(first(), 'free-round', 'free-round');
    expect(round.clocks.pro).toEqual({
      side: 'pro',
      planned: 90,
      timing: { planned: 90, used: 8, rest: 82, overtime: 0 },
    });
    expect(round.clocks.con.timing?.used).toBe(12);
    expect(round.share).toEqual({ pro: 0.4, con: 0.6 });
    expect(round.teamTurns).toEqual({ pro: 2, con: 1 });
    expect(round.speakers.con).toEqual([
      { slot: 0, name: 'Dirk', turns: 0 },
      { slot: 1, name: 'Eva', turns: 1 },
    ]);
  });

  it('has no share for a free round that never ran', () => {
    const round = result(report().debates[1], 'free-round', 'free-round');
    expect(round.share).toBeNull();
    expect(round.clocks.pro.timing).toBeNull();
  });

  it('gives the votes and the shift', () => {
    const { vote } = first();
    expect(vote?.before).toMatchObject({ votes: { pro: 10, con: 15 }, counted: true });
    expect(vote?.after).toMatchObject({ votes: { pro: 13, con: 11 }, counted: true });
    expect(vote?.shift?.absolute).toBe(3);
    expect(vote?.shift?.pp).toBeCloseTo(14.17, 2);
  });

  it('tells a vote that was not counted from one of 0 against 0', () => {
    const { vote } = report().debates[1];
    expect(vote?.before).toMatchObject({ votes: { pro: 8, con: 0 }, counted: true });
    expect(vote?.after).toMatchObject({ votes: { pro: 0, con: 0 }, counted: false });
    expect(vote?.shift?.pp).toBeNull();
  });

  it('has no vote for a format without one, and no shift without both', () => {
    const withoutBefore: DebateConfig = {
      ...config,
      format: {
        ...config.format,
        steps: config.format.steps.filter((step) => step.type !== 'vote-before'),
      },
    };
    const state = { ...playedSession(), config: withoutBefore };
    const { vote } = report(state).debates[0];
    expect(vote?.before).toBeNull();
    expect(vote?.after?.votes).toEqual({ pro: 13, con: 11 });
    expect(vote?.shift).toBeNull();

    const noVotes: DebateConfig = {
      ...config,
      format: {
        ...config.format,
        steps: config.format.steps.filter((step) => !step.type.startsWith('vote')),
      },
    };
    expect(report({ ...playedSession(), config: noVotes }).debates[0].vote).toBeNull();
  });

  it('follows the setup as it is now: a topic that is gone, a step that was removed', () => {
    const state = playedSession();
    const retold = setTopicText(state.config, 't2', 'Homework should be banned.');
    const changed: DebateConfig = {
      ...retold,
      topics: retold.topics.filter((topic) => topic.id !== 't1'),
      format: {
        ...state.config.format,
        steps: state.config.format.steps.filter((step) => step.id !== 'opening-pro'),
      },
    };
    const [d1, d2] = report({ ...state, config: changed }).debates;
    expect(d1.topic).toBeNull();
    expect(d2.topic?.text).toBe('Homework should be banned.');
    expect(d1.steps.some((step) => step.step.id === 'opening-pro')).toBe(false);
    // Ann's opening is no longer counted.
    expect(d1.teams.pro[0]).toMatchObject({ name: 'Ann', speeches: 0, turns: 1 });
  });
});

describe('stepResult', () => {
  it('has a result of its own kind for every kind of step', () => {
    const [debate] = playedSession().session.debates;
    for (const step of config.format.steps as readonly Step[]) {
      expect(stepResult(debate, step, 0).type).toBe(step.type);
    }
  });
});

describe('formatHas', () => {
  it('says whether a format has a kind of step', () => {
    expect(formatHas(config.format, 'free-round')).toBe(true);
    const steps = config.format.steps.filter((step) => step.type !== 'free-round');
    expect(formatHas({ ...config.format, steps }, 'free-round')).toBe(false);
  });
});
