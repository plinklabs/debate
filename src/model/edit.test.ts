// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { DebateConfig, Step } from './config';
import {
  NEW_PREP_SECONDS,
  NEW_STEP_SECONDS,
  addStep,
  addTopic,
  moveStep,
  moveTopic,
  removeStep,
  removeTopic,
  setFormat,
  setPrepTime,
  setSideLabel,
  setStepLabel,
  setStepSeconds,
  setStepSide,
  setStepType,
  setTeamSize,
  setTopicText,
  withStepType,
} from './edit';
import { GRAFFITI_PRESET, KARL_POPPER_PRESET } from './presets';
import { parseConfig, type ConfigIssue } from './validate';

const config = GRAFFITI_PRESET.build('nl');

const topicIds = (edited: DebateConfig) => edited.topics.map((topic) => topic.id);
const stepIds = (edited: DebateConfig) => edited.format.steps.map((step) => step.id);

function stepOf(edited: DebateConfig, id: string): Step {
  const step = edited.format.steps.find((candidate) => candidate.id === id);
  if (step === undefined) throw new Error(`no step ${id}`);
  return step;
}

function issuesOf(edited: DebateConfig): readonly ConfigIssue[] {
  const result = parseConfig(edited);
  return result.ok ? [] : result.issues;
}

describe('editing topics', () => {
  it('adds a topic at the end with the first free id', () => {
    const edited = addTopic(config, 'Musea moeten gratis zijn.');
    expect(edited.topics.at(-1)).toEqual({ id: 't6', text: 'Musea moeten gratis zijn.' });
    expect(config.topics).toHaveLength(5);
  });

  it('does not reuse the id of a topic that debates still refer to', () => {
    const edited = addTopic(removeTopic(config, 't2'), 'Nieuw', ['t2']);
    expect(topicIds(edited)).toEqual(['t1', 't3', 't4', 't5', 't6']);
    expect(topicIds(addTopic(removeTopic(config, 't2'), 'Nieuw'))).toContain('t2');
  });

  it('changes, removes and reorders topics by id', () => {
    expect(setTopicText(config, 't3', 'Anders').topics[2]).toEqual({ id: 't3', text: 'Anders' });
    expect(topicIds(removeTopic(config, 't1'))).toEqual(['t2', 't3', 't4', 't5']);
    expect(topicIds(moveTopic(config, 't3', -1))).toEqual(['t1', 't3', 't2', 't4', 't5']);
    expect(topicIds(moveTopic(config, 't3', 1))).toEqual(['t1', 't2', 't4', 't3', 't5']);
  });

  it('leaves the list alone for a move past either end', () => {
    expect(moveTopic(config, 't1', -1)).toBe(config);
    expect(moveTopic(config, 't5', 1)).toBe(config);
    expect(moveTopic(config, 't9', 1)).toBe(config);
  });

  it('can produce an empty topic, which validation then refuses', () => {
    expect(issuesOf(setTopicText(config, 't1', '  '))).toEqual([
      { code: 'empty', path: ['topics', 0, 'text'] },
    ]);
    expect(issuesOf(addTopic(config, ''))).toEqual([
      { code: 'empty', path: ['topics', 5, 'text'] },
    ]);
  });
});

describe('editing the format', () => {
  it('changes a side label and the team size', () => {
    const edited = setTeamSize(setSideLabel(config, 'con', 'CONTRA'), 'max', 4);
    expect(edited.format.sides).toEqual({ pro: 'VOOR', con: 'CONTRA' });
    expect(edited.format.teamSize).toEqual({ min: 2, max: 4 });
    expect(config.format.teamSize).toEqual({ min: 2, max: 3 });
  });

  it('takes another format and keeps the topics', () => {
    const english = GRAFFITI_PRESET.build('en').format;
    const edited = setFormat(setTopicText(config, 't1', 'Eigen stelling'), english);
    expect(edited.format).toBe(english);
    expect(edited.topics[0].text).toBe('Eigen stelling');
  });

  it('refuses a team size out of range, or a minimum above the maximum', () => {
    expect(issuesOf(setTeamSize(config, 'min', 0))).toEqual([
      { code: 'out-of-range', path: ['format', 'teamSize', 'min'], value: 0, min: 1, max: 8 },
    ]);
    expect(issuesOf(setTeamSize(config, 'max', 9))).toEqual([
      { code: 'out-of-range', path: ['format', 'teamSize', 'max'], value: 9, min: 1, max: 8 },
    ]);
    expect(issuesOf(setTeamSize(config, 'min', 4))).toEqual([
      { code: 'team-size-order', path: ['format', 'teamSize'], min: 4, max: 3 },
    ]);
  });

  it('adds a speech without a label of its own, with an id no step or result has', () => {
    const edited = addStep(config);
    expect(edited.format.steps.at(-1)).toEqual({
      id: 's1',
      type: 'speech',
      label: '',
      side: 'pro',
      seconds: NEW_STEP_SECONDS,
    });
    expect(stepIds(addStep(edited, ['s2', 's3']))).toContain('s4');
    expect(issuesOf(edited)).toEqual([]);
  });

  it('removes and reorders steps by id', () => {
    expect(stepIds(removeStep(config, 'consultation'))).not.toContain('consultation');
    expect(stepIds(moveStep(config, 'closing-pro', -1)).slice(-3)).toEqual([
      'closing-pro',
      'closing-con',
      'vote-after',
    ]);
    expect(moveStep(config, 'vote-before', -1)).toBe(config);
  });

  it('changes the label, side and duration of a step', () => {
    let edited = setStepLabel(config, 'opening-pro', 'Openingsbetoog');
    edited = setStepSide(edited, 'opening-pro', 'con');
    edited = setStepSeconds(edited, 'opening-pro', 75);
    expect(stepOf(edited, 'opening-pro')).toEqual({
      id: 'opening-pro',
      type: 'speech',
      label: 'Openingsbetoog',
      side: 'con',
      seconds: 75,
    });
  });

  it('gives no side or duration to a step that has none', () => {
    expect(stepOf(setStepSide(config, 'consultation', 'con'), 'consultation')).toEqual(
      stepOf(config, 'consultation'),
    );
    expect(stepOf(setStepSeconds(config, 'vote-after', 30), 'vote-after')).toEqual(
      stepOf(config, 'vote-after'),
    );
    expect(stepOf(setStepSeconds(config, 'free-round', 120), 'free-round')).toMatchObject({
      seconds: 120,
    });
  });

  it('refuses a step of zero seconds', () => {
    expect(issuesOf(setStepSeconds(config, 'consultation', 0))).toEqual([
      {
        code: 'out-of-range',
        path: ['format', 'steps', 3, 'seconds'],
        value: 0,
        min: 1,
        max: 3600,
      },
    ]);
    expect(issuesOf(setStepSeconds(config, 'consultation', Number.NaN))).toEqual([
      { code: 'wrong-type', path: ['format', 'steps', 3, 'seconds'], expected: 'integer' },
    ]);
  });

  it('changes the type of a step and keeps what still applies', () => {
    const speech = stepOf(config, 'rebuttal-con');
    expect(withStepType(speech, 'free-round')).toEqual({
      id: 'rebuttal-con',
      label: 'Weerlegging',
      type: 'free-round',
      seconds: 90,
    });
    expect(withStepType(speech, 'vote-after')).toEqual({
      id: 'rebuttal-con',
      label: 'Weerlegging',
      type: 'vote-after',
    });
    const vote = stepOf(config, 'vote-before');
    expect(withStepType(vote, 'speech')).toEqual({
      id: 'vote-before',
      label: 'Stemming vooraf',
      type: 'speech',
      side: 'pro',
      seconds: NEW_STEP_SECONDS,
    });
    expect(setStepType(config, 'opening-pro', 'speech')).toEqual(config);
  });

  it('can produce a second vote, or votes in the wrong order, which validation then refuses', () => {
    expect(issuesOf(setStepType(config, 'consultation', 'vote-before'))).toEqual([
      {
        code: 'duplicate-step-type',
        path: ['format', 'steps', 3, 'type'],
        stepType: 'vote-before',
      },
    ]);
    // Everything but the two votes.
    const votesOnly = config.format.steps
      .filter((step) => step.type !== 'vote-before' && step.type !== 'vote-after')
      .reduce((edited, step) => removeStep(edited, step.id), config);
    expect(stepIds(votesOnly)).toEqual(['vote-before', 'vote-after']);
    expect(issuesOf(moveStep(votesOnly, 'vote-after', -1))).toEqual([
      { code: 'vote-order', path: ['format', 'steps', 0] },
    ]);
    expect(issuesOf(removeStep(removeStep(votesOnly, 'vote-after'), 'vote-before'))).toEqual([
      { code: 'too-few', path: ['format', 'steps'], count: 0, min: 1 },
    ]);
  });
});

describe('editing cross-examinations, audience questions and prep time (#8)', () => {
  const popper = KARL_POPPER_PRESET.build('en');

  it('turns a speech into a cross-examination asked by its side, and back', () => {
    const speech = stepOf(config, 'rebuttal-con');
    const crossExamination = withStepType(speech, 'cross-examination');
    expect(crossExamination).toEqual({
      id: 'rebuttal-con',
      label: 'Weerlegging',
      type: 'cross-examination',
      askingSide: 'con',
      seconds: 90,
    });
    expect(withStepType(crossExamination, 'speech')).toEqual(speech);
  });

  it('gives a step that becomes a cross-examination without a side the side for the topic', () => {
    expect(withStepType(stepOf(config, 'vote-before'), 'cross-examination')).toEqual({
      id: 'vote-before',
      label: 'Stemming vooraf',
      type: 'cross-examination',
      askingSide: 'pro',
      seconds: NEW_STEP_SECONDS,
    });
  });

  it('turns any step into audience questions, keeping its duration', () => {
    expect(withStepType(stepOf(config, 'free-round'), 'audience-questions')).toEqual({
      id: 'free-round',
      label: 'Vrije ronde',
      type: 'audience-questions',
      seconds: 90,
    });
    expect(
      withStepType(withStepType(stepOf(config, 'vote-after'), 'audience-questions'), 'vote-after'),
    ).toEqual(stepOf(config, 'vote-after'));
  });

  it('changes the side that asks and the duration of a cross-examination', () => {
    const edited = setStepSeconds(
      setStepSide(popper, 'cross-examination-con-1', 'pro'),
      'cross-examination-con-1',
      120,
    );
    expect(stepOf(edited, 'cross-examination-con-1')).toMatchObject({
      askingSide: 'pro',
      seconds: 120,
    });
    expect(issuesOf(edited)).toEqual([]);
  });

  it('changes the duration of audience questions, and gives them no side', () => {
    const questions = setStepType(config, 'consultation', 'audience-questions');
    const edited = setStepSide(
      setStepSeconds(questions, 'consultation', 600),
      'consultation',
      'con',
    );
    expect(stepOf(edited, 'consultation')).toEqual({
      id: 'consultation',
      label: 'Kort overleg',
      type: 'audience-questions',
      seconds: 600,
    });
  });

  it('switches the prep-time bank on and off, and sets how much each team gets', () => {
    const on = setPrepTime(config, NEW_PREP_SECONDS);
    expect(on.format.prepTime).toEqual({ secondsPerTeam: 240 });
    expect(on.format.steps).toBe(config.format.steps);
    expect(setPrepTime(on, 90).format.prepTime).toEqual({ secondsPerTeam: 90 });

    // Off, the field is gone: the format reads and shares as one from before #8.
    const off = setPrepTime(on, null);
    expect(Object.hasOwn(off.format, 'prepTime')).toBe(false);
    expect(off).toEqual(config);
    expect(Object.hasOwn(setPrepTime(popper, null).format, 'prepTime')).toBe(false);
  });

  it('can produce a bank of zero seconds, which validation then refuses', () => {
    expect(issuesOf(setPrepTime(config, 0))).toEqual([
      {
        code: 'out-of-range',
        path: ['format', 'prepTime', 'secondsPerTeam'],
        value: 0,
        min: 1,
        max: 3600,
      },
    ]);
    expect(issuesOf(setPrepTime(config, Number.NaN))).toEqual([
      { code: 'wrong-type', path: ['format', 'prepTime', 'secondsPerTeam'], expected: 'integer' },
    ]);
  });
});
