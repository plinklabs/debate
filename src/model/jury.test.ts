// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { graffitiWithJury, playedJurySession } from '../test/playedSession';
import type { DebateConfig, Rubric } from './config';
import {
  FIRST_JUROR_ID,
  MAX_JURORS,
  averageSheet,
  isTargetKey,
  juryOf,
  scoreOf,
  scoreTargets,
  sheetOf,
  targetKey,
  weightedTotal,
  type ScoreTarget,
} from './jury';
import { GRAFFITI_PRESET } from './presets';
import { initialState, reducer, type Action, type AppState } from './reducer';
import { NO_JURY, hasResults, scoredCriterionIds, type Debate } from './session';

const FOR: ScoreTarget = { side: 'pro', slot: null };
const AGAINST: ScoreTarget = { side: 'con', slot: null };

function rubricOf(config: DebateConfig): Rubric {
  const { rubric } = config.format;
  if (rubric === undefined) throw new Error('no rubric');
  return rubric;
}

/** Debate 1 open at the jury step: Ann and Bert for the topic, Dirk and Eva against it. */
function atJury(config: DebateConfig = graffitiWithJury(), ...actions: Action[]): AppState {
  const names: Action[] = [
    { type: 'set-name', debateId: 'd1', side: 'pro', slot: 0, name: 'Ann' },
    { type: 'set-name', debateId: 'd1', side: 'pro', slot: 1, name: 'Bert' },
    { type: 'set-name', debateId: 'd1', side: 'con', slot: 0, name: 'Dirk' },
    { type: 'set-name', debateId: 'd1', side: 'con', slot: 1, name: 'Eva' },
  ];
  const all: Action[] = [
    { type: 'add-debate', topicId: 't1' },
    ...names,
    { type: 'open-debate', debateId: 'd1', now: 0 },
    { type: 'go-to-step', step: config.format.steps.length - 1, now: 0 },
    ...actions,
  ];
  return all.reduce(reducer, initialState(config));
}

function debateOf(state: AppState): Debate {
  return state.session.debates[0];
}

const score = (
  criterionId: string,
  value: number | null,
  target: ScoreTarget = FOR,
  jurorId = FIRST_JUROR_ID,
): Action => ({ type: 'set-score', jurorId, target, criterionId, score: value });

describe('the jury of a debate', () => {
  it('opens on a first, empty juror while nobody scored', () => {
    const debate = debateOf(atJury());
    expect(debate.jury).toBe(NO_JURY);
    expect(juryOf(debate)).toEqual({
      jurors: [{ id: 'j1', name: '', scores: {} }],
      current: 'j1',
    });
    expect(hasResults(debate)).toBe(false);
  });

  it('keeps that juror once they score, and the debate then has results', () => {
    const debate = debateOf(reducer(atJury(), score('content', 3)));
    expect(debate.jury).toEqual({
      jurors: [{ id: 'j1', name: '', scores: { pro: { content: 3 } } }],
      current: 'j1',
    });
    expect(hasResults(debate)).toBe(true);
  });

  it('scores the teams, or each student with a name, as the rubric says', () => {
    const { teams } = debateOf(atJury());
    const rubric = rubricOf(graffitiWithJury());
    expect(scoreTargets(rubric, teams)).toEqual([FOR, AGAINST]);
    expect(scoreTargets({ ...rubric, scope: 'student' }, teams)).toEqual([
      { side: 'pro', slot: 0 },
      { side: 'pro', slot: 1 },
      { side: 'con', slot: 0 },
      { side: 'con', slot: 1 },
    ]);
  });

  it('keeps a team’s and a student’s scores under keys of their own', () => {
    expect(targetKey(FOR)).toBe('pro');
    expect(targetKey({ side: 'con', slot: 2 })).toBe('con-2');
    expect(['pro', 'con', 'pro-0', 'con-7'].every(isTargetKey)).toBe(true);
    expect(['pro-8', 'both', '__proto__', 'pro-', 'pro-01', 'constructor'].some(isTargetKey)).toBe(
      false,
    );
  });
});

describe('scoring', () => {
  it('sets, changes and clears a score, without a clock', () => {
    const set = reducer(atJury(), score('content', 3));
    const changed = reducer(set, score('content', 4));
    expect(debateOf(changed).jury.jurors[0].scores).toEqual({ pro: { content: 4 } });
    const cleared = reducer(changed, score('content', null));
    expect(debateOf(cleared).jury.jurors[0].scores).toEqual({});
    expect(hasResults(debateOf(cleared))).toBe(false);
  });

  it('changes nothing when the score is the same, or when there is none to clear', () => {
    const set = reducer(atJury(), score('content', 3));
    expect(reducer(set, score('content', 3))).toBe(set);
    expect(reducer(set, score('rebuttal', null))).toBe(set);
  });

  it.each([
    ['below the scale', score('content', 0)],
    ['above the scale', score('content', 5)],
    ['not a whole number', score('content', 2.5)],
    ['not a number at all', score('content', Number.NaN)],
    ['on a criterion the rubric does not have', score('humour', 3)],
    ['for a student when the rubric scores teams', score('content', 3, { side: 'pro', slot: 0 })],
    ['as a juror who is not on the jury', score('content', 3, FOR, 'j2')],
  ])('keeps the scores within the rubric: none %s', (_, action) => {
    const state = atJury();
    expect(reducer(state, action)).toBe(state);
  });

  it('scores a student with a name when the rubric scores students, and no one else', () => {
    const config = graffitiWithJury('student');
    const state = atJury(config);
    const ann = reducer(state, score('content', 3, { side: 'pro', slot: 0 }));
    expect(debateOf(ann).jury.jurors[0].scores).toEqual({ 'pro-0': { content: 3 } });
    // A team, or a slot without a name.
    expect(reducer(state, score('content', 3))).toBe(state);
    expect(reducer(state, score('content', 3, { side: 'pro', slot: 2 }))).toBe(state);
  });

  it('needs a rubric and an open debate', () => {
    const plain = GRAFFITI_PRESET.build('en');
    const withoutRubric = atJury(plain);
    expect(reducer(withoutRubric, score('content', 3))).toBe(withoutRubric);
    expect(reducer(withoutRubric, { type: 'add-juror' })).toBe(withoutRubric);
    const closed = reducer(atJury(), { type: 'close-debate', now: 0 });
    expect(reducer(closed, score('content', 3))).toBe(closed);
  });

  it('keeps the scores when the setup changes, and reads only those the rubric still has', () => {
    const state = reducer(reducer(atJury(), score('content', 4)), score('rebuttal', 2));
    const config = state.config;
    const rubric = rubricOf(config);
    // The scale goes down to 1–3: a 4 is off it, and counts as not given.
    const narrower = reducer(state, {
      type: 'set-config',
      config: {
        ...config,
        format: { ...config.format, rubric: { ...rubric, scale: { min: 1, max: 3 } } },
      },
      now: 0,
    });
    const [juror] = juryOf(debateOf(narrower)).jurors;
    expect(juror.scores).toEqual({ pro: { content: 4, rebuttal: 2 } });
    const smaller = rubricOf(narrower.config);
    expect(scoreOf(smaller, juror, FOR, 'content')).toBeNull();
    expect(sheetOf(smaller, juror, FOR)).toEqual({ scores: [null, 2, null, null], total: 2 });
    // A new criterion does not take an id that has scores.
    expect([...scoredCriterionIds(narrower.session)].sort()).toEqual(['content', 'rebuttal']);
  });
});

describe('jurors', () => {
  it('adds a juror after the others, whose sheet opens', () => {
    const state = reducer(reducer(atJury(), score('content', 3)), { type: 'add-juror' });
    const jury = juryOf(debateOf(state));
    expect(jury.jurors.map((juror) => juror.id)).toEqual(['j1', 'j2']);
    expect(jury.current).toBe('j2');
    // The first one stays, even before they scored.
    const fresh = juryOf(debateOf(reducer(atJury(), { type: 'add-juror' })));
    expect(fresh.jurors.map((juror) => juror.id)).toEqual(['j1', 'j2']);
  });

  it(`adds ${MAX_JURORS} jurors at most`, () => {
    const actions = Array.from({ length: MAX_JURORS + 2 }, (): Action => ({ type: 'add-juror' }));
    const state = atJury(graffitiWithJury(), ...actions);
    expect(juryOf(debateOf(state)).jurors).toHaveLength(MAX_JURORS);
  });

  it('switches between jurors, each with their own sheet', () => {
    const state = atJury(
      graffitiWithJury(),
      score('content', 3),
      { type: 'add-juror' },
      score('content', 1, FOR, 'j2'),
      { type: 'select-juror', jurorId: 'j1' },
    );
    const jury = juryOf(debateOf(state));
    expect(jury.current).toBe('j1');
    expect(jury.jurors.map((juror) => juror.scores)).toEqual([
      { pro: { content: 3 } },
      { pro: { content: 1 } },
    ]);
    expect(reducer(state, { type: 'select-juror', jurorId: 'j1' })).toBe(state);
    expect(reducer(state, { type: 'select-juror', jurorId: 'j9' })).toBe(state);
  });

  it('names a juror, cut to the length of a name', () => {
    const state = reducer(atJury(), { type: 'set-juror-name', jurorId: 'j1', name: 'Mr. Smith' });
    expect(juryOf(debateOf(state)).jurors[0].name).toBe('Mr. Smith');
    const long = reducer(state, { type: 'set-juror-name', jurorId: 'j1', name: 'x'.repeat(50) });
    expect(juryOf(debateOf(long)).jurors[0].name).toBe('x'.repeat(40));
    // A name is not a score.
    expect(hasResults(debateOf(state))).toBe(false);
  });

  it('removes a juror with their scores; the next one’s sheet opens, or the one before', () => {
    const three = atJury(
      graffitiWithJury(),
      score('content', 3),
      { type: 'add-juror' },
      score('content', 2, FOR, 'j2'),
      { type: 'add-juror' },
      score('content', 1, FOR, 'j3'),
      { type: 'select-juror', jurorId: 'j2' },
    );
    const middle = juryOf(debateOf(reducer(three, { type: 'remove-juror', jurorId: 'j2' })));
    expect(middle.jurors.map((juror) => juror.id)).toEqual(['j1', 'j3']);
    expect(middle.current).toBe('j3');
    const last = juryOf(debateOf(reducer(three, { type: 'remove-juror', jurorId: 'j3' })));
    expect(last.current).toBe('j2');
    const other = juryOf(debateOf(reducer(three, { type: 'remove-juror', jurorId: 'j1' })));
    expect(other.current).toBe('j2');
    expect(reducer(three, { type: 'remove-juror', jurorId: 'j9' })).toBe(three);
  });

  it('leaves the jury untouched again when the only juror goes', () => {
    const state = reducer(atJury(), score('content', 3));
    const removed = reducer(state, { type: 'remove-juror', jurorId: 'j1' });
    expect(debateOf(removed).jury).toBe(NO_JURY);
    expect(reducer(atJury(), { type: 'remove-juror', jurorId: 'j1' })).toEqual(atJury());
  });

  it('clears every juror and score with the jury step’s Clear', () => {
    const state = playedJurySession();
    const open = reducer(state, { type: 'open-debate', debateId: 'd1', now: 0 });
    const cleared = reducer(open, { type: 'clear-step' });
    expect(debateOf(cleared).jury).toBe(NO_JURY);
    // The other steps keep what they had.
    expect(debateOf(cleared).records).toBe(debateOf(open).records);
    expect(reducer(cleared, { type: 'clear-step' })).toBe(cleared);
  });
});

describe('totals', () => {
  const rubric = rubricOf(graffitiWithJury());

  it('weighs each score with its criterion, and leaves out what was not scored', () => {
    const criteria = rubric.criteria.map((criterion, index) => ({
      ...criterion,
      weight: index + 1,
    }));
    expect(weightedTotal(criteria, [4, 3, 2, 1])).toBe(4 + 6 + 6 + 4);
    expect(weightedTotal(criteria, [4, null, null, 1])).toBe(8);
    expect(weightedTotal(criteria, [null, null, null, null])).toBeNull();
  });

  it('averages the jurors per criterion and in total, over those who scored', () => {
    expect(
      averageSheet(rubric, [
        { scores: [4, 3, null, null], total: 7 },
        { scores: [2, null, null, null], total: 2 },
        { scores: [null, null, null, null], total: null },
      ]),
    ).toEqual({ scores: [3, 3, null, null], total: 4.5 });
    expect(averageSheet(rubric, [])).toEqual({ scores: [null, null, null, null], total: null });
  });

  it('gives each juror of the played session their sheet', () => {
    const [debate] = playedJurySession().session.debates;
    const [first, second] = juryOf(debate).jurors;
    expect(second.name).toBe('Mr. Smith');
    expect(sheetOf(rubric, first, FOR)).toEqual({ scores: [3, 2, 4, 3], total: 12 });
    expect(sheetOf(rubric, second, AGAINST)).toEqual({ scores: [3, 3, 2, 2], total: 10 });
    expect(scoreOf(rubric, first, FOR, 'constructor')).toBeNull();
  });
});
