// Sessions as a class leaves them, for the report tests (#7): the graffiti
// format, debate 1 played and finished, debate 2 begun, debate 3 with names
// only; a Karl Popper debate with prep time and audience questions (#8); and
// a graffiti debate scored by two jurors on the standard rubric (#10).
// Time is in seconds on a fake clock.
import type { DebateConfig } from '../model/config';
import { GRAFFITI_PRESET, KARL_POPPER_PRESET, standardRubric } from '../model/presets';
import { initialState, reducer, type Action, type AppState } from '../model/reducer';

const at = (seconds: number) => seconds * 1000;

/** Names for the four students of debate 1; the last one can be anything typed. */
export interface PlayedNames {
  readonly ann?: string;
  readonly eva?: string;
}

/**
 * Debate 1 on t1, finished: votes 10–15 before and 13–11 after; the opening
 * for 72 s (12 over) by Ann then Bert; the opening against 45 s (15 early) by
 * Dirk; the free round 8 s for (Ann, then Bert later) and 12 s against (Eva).
 * Debate 2 on t2: only the vote before, 8–0. Debate 3 on t3: names, nothing
 * recorded.
 */
export function playedSession(
  config: DebateConfig = GRAFFITI_PRESET.build('en'),
  { ann = 'Ann', eva = 'Eva' }: PlayedNames = {},
): AppState {
  const names = (debateId: string, pro: string[], con: string[]): Action[] => [
    ...pro.map((name, slot): Action => ({ type: 'set-name', debateId, side: 'pro', slot, name })),
    ...con.map((name, slot): Action => ({ type: 'set-name', debateId, side: 'con', slot, name })),
  ];
  const actions: Action[] = [
    { type: 'add-debate', topicId: 't1' },
    ...names('d1', [ann, 'Bert'], ['Dirk', eva]),
    { type: 'open-debate', debateId: 'd1', now: 0 },
    { type: 'set-votes', side: 'pro', value: 10 },
    { type: 'set-votes', side: 'con', value: 15 },
    { type: 'next-step', now: 0 },
    { type: 'tap-speaker', side: 'pro', slot: 0, now: at(0) },
    { type: 'tap-speaker', side: 'pro', slot: 1, now: at(30) },
    { type: 'next-step', now: at(72) },
    { type: 'tap-speaker', side: 'con', slot: 0, now: at(72) },
    { type: 'go-to-step', step: 6, now: at(117) },
    { type: 'tap-speaker', side: 'pro', slot: 0, now: at(120) },
    { type: 'tap-speaker', side: 'con', slot: 1, now: at(125) },
    { type: 'tap-speaker', side: 'pro', slot: 1, now: at(137) },
    { type: 'go-to-step', step: 9, now: at(140) },
    { type: 'set-votes', side: 'pro', value: 13 },
    { type: 'set-votes', side: 'con', value: 11 },
    { type: 'finish-debate', now: at(141) },
    { type: 'add-debate', topicId: 't2' },
    ...names('d2', ['Fien', 'Gert'], ['Hanne', 'Ilse']),
    { type: 'open-debate', debateId: 'd2', now: at(200) },
    { type: 'set-votes', side: 'pro', value: 8 },
    { type: 'close-debate', now: at(200) },
    { type: 'add-debate', topicId: 't3' },
    ...names('d3', ['Jan', 'Kim'], ['Lot', 'Mo']),
  ];
  return actions.reduce(reducer, initialState(config));
}

/**
 * The Karl Popper format with a bank of 30 s per team and audience questions
 * of 2 minutes added at the end (step 11), as the e2e test of #8 sets it up.
 */
export function popperWithQuestions(): DebateConfig {
  const config = KARL_POPPER_PRESET.build('en');
  return {
    ...config,
    format: {
      ...config.format,
      prepTime: { secondsPerTeam: 30 },
      steps: [
        ...config.format.steps,
        { id: 's1', type: 'audience-questions', label: '', seconds: 120 },
      ],
    },
  };
}

/**
 * Debate 1 in that format, finished: in the first cross-examination Dirk asks
 * and Ann answers, for 25 s; the negative team prepares 35 s in all, 5 s past
 * its bank; the audience questions take 30 s, with 2 answers by the
 * affirmative and 1 by the negative.
 */
export function playedPopperSession(): AppState {
  const config = popperWithQuestions();
  const team = (side: 'pro' | 'con', names: string[]): Action[] =>
    names.map((name, slot) => ({ type: 'set-name', debateId: 'd1', side, slot, name }));
  const actions: Action[] = [
    { type: 'add-debate', topicId: 't1' },
    ...team('pro', ['Ann', 'Bert', 'Cas']),
    ...team('con', ['Dirk', 'Eva', 'Fien']),
    { type: 'open-debate', debateId: 'd1', now: 0 },
    { type: 'go-to-step', step: 1, now: 0 },
    { type: 'tap-speaker', side: 'con', slot: 0, now: at(0) },
    { type: 'tap-speaker', side: 'pro', slot: 0, now: at(0) },
    { type: 'toggle-prep', side: 'con', now: at(20) },
    { type: 'toggle-timer', now: at(30) },
    { type: 'toggle-prep', side: 'con', now: at(35) },
    { type: 'toggle-prep', side: 'con', now: at(60) },
    { type: 'go-to-step', step: 10, now: at(60) },
    { type: 'toggle-timer', now: at(60) },
    { type: 'adjust-answers', side: 'pro', delta: 1 },
    { type: 'adjust-answers', side: 'pro', delta: 1 },
    { type: 'adjust-answers', side: 'con', delta: 1 },
    { type: 'finish-debate', now: at(90) },
  ];
  return actions.reduce(reducer, initialState(config));
}

/**
 * The graffiti format with the standard rubric (#10) in English and a jury
 * step added at the end (step 11, id `s1`), as the e2e test of #10 sets it up.
 */
export function graffitiWithJury(scope: 'team' | 'student' = 'team'): DebateConfig {
  const config = GRAFFITI_PRESET.build('en');
  return {
    ...config,
    format: {
      ...config.format,
      rubric: { ...standardRubric('en'), scope },
      steps: [...config.format.steps, { id: 's1', type: 'jury', label: '' }],
    },
  };
}

/** Juror `jurorId` scores a team on the four standard criteria, in their order. */
function scoreTeam(jurorId: string, side: 'pro' | 'con', scores: readonly number[]): Action[] {
  const criteria = ['content', 'rebuttal', 'evidence', 'delivery'];
  return scores.map((score, index) => ({
    type: 'set-score',
    jurorId,
    target: { side, slot: null },
    criterionId: criteria[index],
    score,
  }));
}

/**
 * Debate 1 in that format, finished at the jury step: juror 1 scores the for
 * team 3, 2, 4, 3 (12) and the against team 2, 3, 3, 2 (10); juror 2, Mr.
 * Smith, scores them 4, 3, 3, 4 (14) and 3, 3, 2, 2 (10). On average 13 for
 * and 10 against.
 */
export function playedJurySession(): AppState {
  const config = graffitiWithJury();
  const team = (side: 'pro' | 'con', names: string[]): Action[] =>
    names.map((name, slot) => ({ type: 'set-name', debateId: 'd1', side, slot, name }));
  const actions: Action[] = [
    { type: 'add-debate', topicId: 't1' },
    ...team('pro', ['Ann', 'Bert']),
    ...team('con', ['Dirk', 'Eva']),
    { type: 'open-debate', debateId: 'd1', now: 0 },
    { type: 'go-to-step', step: 10, now: 0 },
    ...scoreTeam('j1', 'pro', [3, 2, 4, 3]),
    ...scoreTeam('j1', 'con', [2, 3, 3, 2]),
    { type: 'add-juror' },
    { type: 'set-juror-name', jurorId: 'j2', name: 'Mr. Smith' },
    ...scoreTeam('j2', 'pro', [4, 3, 3, 4]),
    ...scoreTeam('j2', 'con', [3, 3, 2, 2]),
    { type: 'finish-debate', now: at(10) },
  ];
  return actions.reduce(reducer, initialState(config));
}
