// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  graffitiWithJury,
  playedJurySession,
  playedPopperSession,
  playedSession,
  popperWithQuestions,
} from '../test/playedSession';
import { STEP_TYPES, type DebateConfig, type Step } from './config';
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
      { slot: 0, name: 'Ann', speeches: 1, crossExaminations: 0, freeRoundTurns: 1, turns: 2 },
      { slot: 1, name: 'Bert', speeches: 1, crossExaminations: 0, freeRoundTurns: 1, turns: 2 },
    ]);
    expect(debate.teams.con).toEqual([
      { slot: 0, name: 'Dirk', speeches: 1, crossExaminations: 0, freeRoundTurns: 0, turns: 1 },
      { slot: 1, name: 'Eva', speeches: 0, crossExaminations: 0, freeRoundTurns: 1, turns: 1 },
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
    const jury = graffitiWithJury().format;
    const steps: readonly Step[] = [...jury.steps, ...popperWithQuestions().format.steps];
    expect(new Set(steps.map((step) => step.type))).toEqual(new Set(STEP_TYPES));
    for (const step of steps) {
      expect(stepResult(debate, step, 0, jury.rubric).type).toBe(step.type);
    }
  });
});

describe('buildReport: cross-examination, audience questions and prep time (#8)', () => {
  const popper = () => {
    const state = playedPopperSession();
    return buildReport(state.config, state.session, 1_000_000).debates[0];
  };

  it('says who asked and who answered in a cross-examination, and its time', () => {
    const debate = popper();
    expect(result(debate, 'cross-examination-con-1', 'cross-examination')).toMatchObject({
      clock: { side: null, planned: 180, timing: { used: 25, rest: 155, overtime: 0 } },
      askers: [{ slot: 0, name: 'Dirk' }],
      answerers: [{ slot: 0, name: 'Ann' }],
    });
    expect(result(debate, 'cross-examination-pro-1', 'cross-examination')).toMatchObject({
      clock: { timing: null },
      askers: [],
      answerers: [],
    });
  });

  it('counts a cross-examination asked or answered in as a turn', () => {
    const debate = popper();
    expect(debate.teams.pro[0]).toEqual({
      slot: 0,
      name: 'Ann',
      speeches: 0,
      crossExaminations: 1,
      freeRoundTurns: 0,
      turns: 1,
    });
    expect(debate.teams.con[0]).toMatchObject({ name: 'Dirk', crossExaminations: 1, turns: 1 });
    expect(debate.teams.con[1]).toMatchObject({ name: 'Eva', crossExaminations: 0, turns: 0 });
  });

  it('gives the time of the audience questions and the answers of each team', () => {
    expect(result(popper(), 's1', 'audience-questions')).toMatchObject({
      clock: { planned: 120, timing: { used: 30, rest: 90 } },
      answers: { pro: 2, con: 1 },
    });
  });

  it('gives what each team used of its prep time, what was left, and any overtime', () => {
    expect(popper().prep).toEqual({
      secondsPerTeam: 30,
      clocks: {
        pro: {
          side: 'pro',
          planned: 30,
          timing: { planned: 30, used: 0, rest: 30, overtime: 0 },
        },
        con: {
          side: 'con',
          planned: 30,
          timing: { planned: 30, used: 35, rest: 0, overtime: 5 },
        },
      },
    });
  });

  it('counts prep time that still runs up to now', () => {
    const state = playedPopperSession();
    const running = reducer(reducer(state, { type: 'open-debate', debateId: 'd1', now: 0 }), {
      type: 'toggle-prep',
      side: 'pro',
      now: 0,
    });
    const [debate] = buildReport(running.config, running.session, 12_000).debates;
    expect(debate.prep?.clocks.pro.timing).toMatchObject({ used: 12, rest: 18 });
  });

  it('has no prep time for a format without a bank', () => {
    expect(first().prep).toBeNull();
  });
});

describe('buildReport: the jury (#10)', () => {
  const jury = (state = playedJurySession()) =>
    result(buildReport(state.config, state.session, 0).debates[0], 's1', 'jury');

  it('names the jurors who scored, by their place on the jury', () => {
    expect(jury().jurors).toEqual([
      { id: 'j1', number: 1, name: '' },
      { id: 'j2', number: 2, name: 'Mr. Smith' },
    ]);
  });

  it('gives each juror’s scores and weighted total per team, and their average', () => {
    const [pro, con] = jury().scored;
    expect(pro).toEqual({
      side: 'pro',
      member: null,
      sheets: [
        { scores: [3, 2, 4, 3], total: 12 },
        { scores: [4, 3, 3, 4], total: 14 },
      ],
      average: { scores: [3.5, 2.5, 3.5, 3.5], total: 13 },
    });
    expect(con.side).toBe('con');
    expect(con.average).toEqual({ scores: [2.5, 3, 2.5, 2], total: 10 });
  });

  it('weighs each criterion by its weight in the total', () => {
    const state = playedJurySession();
    const rubric = state.config.format.rubric;
    if (rubric === undefined) throw new Error('no rubric');
    const weighed = {
      ...state,
      config: {
        ...state.config,
        format: {
          ...state.config.format,
          rubric: {
            ...rubric,
            criteria: rubric.criteria.map((criterion) =>
              criterion.id === 'content' ? { ...criterion, weight: 3 } : criterion,
            ),
          },
        },
      },
    };
    // Juror 1 for: 3×3 + 2 + 4 + 3 = 18; juror 2: 4×3 + 3 + 3 + 4 = 22.
    expect(jury(weighed).scored[0].sheets.map((sheet) => sheet.total)).toEqual([18, 22]);
    expect(jury(weighed).scored[0].average.total).toBe(20);
  });

  it('averages each criterion and the total over the jurors who scored them', () => {
    const state = reducer(
      reducer(reducer(playedJurySession(), { type: 'open-debate', debateId: 'd1', now: 0 }), {
        type: 'add-juror',
      }),
      {
        type: 'set-score',
        jurorId: 'j3',
        target: { side: 'pro', slot: null },
        criterionId: 'content',
        score: 1,
      },
    );
    const [pro, con] = jury(state).scored;
    expect(pro.sheets.map((sheet) => sheet.total)).toEqual([12, 14, 1]);
    expect(pro.average).toEqual({ scores: [(3 + 4 + 1) / 3, 2.5, 3.5, 3.5], total: 9 });
    // Juror 3 gave the against team nothing: it is not part of their average.
    expect(con.sheets[2]).toEqual({ scores: [null, null, null, null], total: null });
    expect(con.average.total).toBe(10);
  });

  it('scores each student when the rubric does, a sheet per student with a name', () => {
    const state = playedJurySession();
    const rubric = state.config.format.rubric;
    if (rubric === undefined) throw new Error('no rubric');
    const perStudent = reducer(
      reducer(
        {
          ...state,
          config: {
            ...state.config,
            format: { ...state.config.format, rubric: { ...rubric, scope: 'student' } },
          },
        },
        { type: 'open-debate', debateId: 'd1', now: 0 },
      ),
      {
        type: 'set-score',
        jurorId: 'j2',
        target: { side: 'con', slot: 1 },
        criterionId: 'delivery',
        score: 4,
      },
    );
    const result = jury(perStudent);
    expect(result.scored.map((scored) => [scored.side, scored.member?.name])).toEqual([
      ['pro', 'Ann'],
      ['pro', 'Bert'],
      ['con', 'Dirk'],
      ['con', 'Eva'],
    ]);
    // The team scores stay in the session, but a rubric per student does not read them.
    expect(result.jurors).toEqual([{ id: 'j2', number: 2, name: 'Mr. Smith' }]);
    expect(result.scored[3].sheets).toEqual([{ scores: [null, null, null, 4], total: 4 }]);
    expect(result.scored[0].average.total).toBeNull();
  });

  it('has no jurors when nobody scored', () => {
    const state = reducer(
      reducer(
        reducer(
          reducer(
            reducer(
              {
                config: graffitiWithJury(),
                session: { debates: [], current: null },
              },
              { type: 'add-debate', topicId: 't1' },
            ),
            { type: 'set-name', debateId: 'd1', side: 'pro', slot: 0, name: 'Ann' },
          ),
          { type: 'set-name', debateId: 'd1', side: 'pro', slot: 1, name: 'Bert' },
        ),
        { type: 'set-name', debateId: 'd1', side: 'con', slot: 0, name: 'Dirk' },
      ),
      { type: 'set-name', debateId: 'd1', side: 'con', slot: 1, name: 'Eva' },
    );
    const finished = reducer(reducer(state, { type: 'open-debate', debateId: 'd1', now: 0 }), {
      type: 'finish-debate',
      now: 0,
    });
    const result = jury(finished);
    expect(result.jurors).toEqual([]);
    expect(result.scored.map((scored) => scored.average)).toEqual([
      { scores: [null, null, null, null], total: null },
      { scores: [null, null, null, null], total: null },
    ]);
  });
});

describe('formatHas', () => {
  it('says whether a format has a kind of step', () => {
    expect(formatHas(config.format, 'free-round')).toBe(true);
    const steps = config.format.steps.filter((step) => step.type !== 'free-round');
    expect(formatHas({ ...config.format, steps }, 'free-round')).toBe(false);
  });
});
