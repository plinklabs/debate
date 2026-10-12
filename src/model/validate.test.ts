// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { DebateConfig } from './config';
import { LOCALES } from './locale';
import { GRAFFITI_PRESET } from './presets';
import { parseConfig, parseConfigJson, type ConfigIssue } from './validate';

/** A config as loose JSON data, so a test can break any part of it. */
interface RawConfig {
  [key: string]: unknown;
  version?: unknown;
  format: {
    [key: string]: unknown;
    sides: Record<string, unknown>;
    teamSize: Record<string, unknown>;
    steps: Record<string, unknown>[];
  };
  topics: Record<string, unknown>[];
}

function rawConfig(): RawConfig {
  return {
    version: 1,
    format: {
      sides: { pro: 'Pro', con: 'Contra' },
      teamSize: { min: 2, max: 3 },
      steps: [
        { id: 'vote-before', type: 'vote-before', label: 'Vote' },
        { id: 'opening', type: 'speech', side: 'pro', seconds: 60, label: 'Opening' },
        { id: 'prepare', type: 'consultation', seconds: 60, label: 'Prepare' },
        { id: 'free', type: 'free-round', seconds: 90, label: 'Free round' },
        { id: 'cross', type: 'cross-examination', askingSide: 'con', seconds: 180, label: 'CX' },
        { id: 'questions', type: 'audience-questions', seconds: 300, label: 'Questions' },
        { id: 'vote-after', type: 'vote-after', label: 'Vote' },
      ],
    },
    topics: [{ id: 't1', text: 'Homework should be banned.' }],
  };
}

function issuesOf(input: unknown): readonly ConfigIssue[] {
  const result = parseConfig(input);
  return result.ok ? [] : result.issues;
}

function configOf(input: unknown): DebateConfig {
  const result = parseConfig(input);
  if (!result.ok) throw new Error(`expected a valid config, got ${JSON.stringify(result.issues)}`);
  return result.config;
}

describe('parseConfig: valid input', () => {
  it.each(LOCALES)('accepts the graffiti preset (%s) unchanged', (locale) => {
    const preset = GRAFFITI_PRESET.build(locale);
    expect(configOf(preset)).toStrictEqual(preset);
    expect(configOf(JSON.parse(JSON.stringify(preset)))).toStrictEqual(preset);
  });

  it('accepts a config with every step type', () => {
    const config = configOf(rawConfig());
    expect(config.format.steps.map((step) => step.type)).toEqual([
      'vote-before',
      'speech',
      'consultation',
      'free-round',
      'cross-examination',
      'audience-questions',
      'vote-after',
    ]);
  });

  it('accepts a blank step label', () => {
    const raw = rawConfig();
    raw.format.steps[1].label = '';
    expect(configOf(raw).format.steps[1].label).toBe('');
  });

  it('keeps only the known fields, so nothing else rides along', () => {
    const raw = rawConfig();
    raw.teams = { pro: ['Ann', 'Bert'], con: ['Cas', 'Dirk'] };
    raw.format.votes = { pro: 12, con: 3 };
    raw.format.steps[0].seconds = 30; // a vote has no timer
    raw.format.steps[1].speakers = ['Ann'];
    raw.format.steps[2].side = 'pro'; // a consultation belongs to both teams
    raw.format.steps[4].side = 'pro'; // a cross-examination has a side that asks
    raw.format.steps[5].answers = { pro: 3, con: 1 }; // counted in a session, not here
    raw.topics[0].names = ['Ann'];

    const config = configOf(raw);

    expect(config).toStrictEqual({
      version: 1,
      format: {
        sides: { pro: 'Pro', con: 'Contra' },
        teamSize: { min: 2, max: 3 },
        steps: [
          { id: 'vote-before', type: 'vote-before', label: 'Vote' },
          { id: 'opening', type: 'speech', side: 'pro', seconds: 60, label: 'Opening' },
          { id: 'prepare', type: 'consultation', seconds: 60, label: 'Prepare' },
          { id: 'free', type: 'free-round', seconds: 90, label: 'Free round' },
          { id: 'cross', type: 'cross-examination', askingSide: 'con', seconds: 180, label: 'CX' },
          { id: 'questions', type: 'audience-questions', seconds: 300, label: 'Questions' },
          { id: 'vote-after', type: 'vote-after', label: 'Vote' },
        ],
      },
      topics: [{ id: 't1', text: 'Homework should be banned.' }],
    });
    expect(JSON.stringify(config)).not.toMatch(/Ann|Bert|Cas|Dirk/);
  });

  it('parses JSON text', () => {
    expect(parseConfigJson(JSON.stringify(rawConfig())).ok).toBe(true);
  });
});

describe('parseConfig: partial input', () => {
  it('reports a missing version and stops there', () => {
    const raw = rawConfig();
    delete raw.version;
    expect(issuesOf(raw)).toEqual([{ code: 'missing-field', path: ['version'] }]);
  });

  it('reports the missing format and topics', () => {
    expect(issuesOf({ version: 1 })).toEqual([
      { code: 'missing-field', path: ['format'] },
      { code: 'missing-field', path: ['topics'] },
    ]);
  });

  it('reports every missing field, with its path', () => {
    const input = {
      version: 1,
      format: {
        sides: { pro: 'Pro' },
        steps: [
          { id: 'opening', type: 'speech', label: 'Opening' },
          { id: 'vote', label: 'Vote' },
          { type: 'consultation', label: 'Prepare', seconds: 60 },
        ],
      },
      topics: [{ id: 't1' }],
    };
    expect(issuesOf(input)).toEqual([
      { code: 'missing-field', path: ['format', 'sides', 'con'] },
      { code: 'missing-field', path: ['format', 'teamSize'] },
      { code: 'missing-field', path: ['format', 'steps', 0, 'side'] },
      { code: 'missing-field', path: ['format', 'steps', 0, 'seconds'] },
      { code: 'missing-field', path: ['format', 'steps', 1, 'type'] },
      { code: 'missing-field', path: ['format', 'steps', 2, 'id'] },
      { code: 'missing-field', path: ['topics', 0, 'text'] },
    ]);
  });

  it('treats null as a value of the wrong type, not as missing', () => {
    const raw = rawConfig();
    raw.format.teamSize = { min: null, max: 3 };
    expect(issuesOf(raw)).toEqual([
      { code: 'wrong-type', path: ['format', 'teamSize', 'min'], expected: 'integer' },
    ]);
  });
});

describe('parseConfig: malformed input', () => {
  it.each([null, [], 'config', 42])('rejects %j as a whole', (input) => {
    expect(issuesOf(input)).toEqual([{ code: 'wrong-type', path: [], expected: 'object' }]);
  });

  it('rejects text that is not JSON', () => {
    expect(parseConfigJson('{"version": 1,')).toEqual({
      ok: false,
      issues: [{ code: 'invalid-json', path: [] }],
    });
  });

  it('tells a config from a newer version apart from a broken version', () => {
    const newer = rawConfig();
    newer.version = 2;
    newer.format = 'whatever version 2 looks like' as never;
    expect(issuesOf(newer)).toEqual([
      { code: 'newer-version', path: ['version'], found: 2, supported: 1 },
    ]);

    for (const version of ['1', 0, 1.5, null]) {
      const raw = rawConfig();
      raw.version = version;
      expect(issuesOf(raw)).toEqual([{ code: 'invalid-version', path: ['version'] }]);
    }
  });

  it('rejects an unknown step type', () => {
    const raw = rawConfig();
    raw.format.steps[2].type = 'dance';
    expect(issuesOf(raw)).toEqual([
      {
        code: 'unknown-step-type',
        path: ['format', 'steps', 2, 'type'],
        stepType: 'dance',
      },
    ]);
  });

  it('rejects an unknown side', () => {
    const raw = rawConfig();
    raw.format.steps[1].side = 'voor';
    expect(issuesOf(raw)).toEqual([
      { code: 'unknown-side', path: ['format', 'steps', 1, 'side'], side: 'voor' },
    ]);
  });

  it.each([
    [0, { code: 'out-of-range', value: 0, min: 1, max: 3600 }],
    [-30, { code: 'out-of-range', value: -30, min: 1, max: 3600 }],
    [3601, { code: 'out-of-range', value: 3601, min: 1, max: 3600 }],
    [1.5, { code: 'wrong-type', expected: 'integer' }],
    ['60', { code: 'wrong-type', expected: 'integer' }],
  ])('rejects a duration of %j', (seconds, issue) => {
    const raw = rawConfig();
    raw.format.steps[3].seconds = seconds;
    expect(issuesOf(raw)).toEqual([{ ...issue, path: ['format', 'steps', 3, 'seconds'] }]);
  });

  it('rejects team sizes out of range or in the wrong order', () => {
    const tooSmall = rawConfig();
    tooSmall.format.teamSize = { min: 0, max: 9 };
    expect(issuesOf(tooSmall)).toEqual([
      { code: 'out-of-range', path: ['format', 'teamSize', 'min'], value: 0, min: 1, max: 8 },
      { code: 'out-of-range', path: ['format', 'teamSize', 'max'], value: 9, min: 1, max: 8 },
    ]);

    const reversed = rawConfig();
    reversed.format.teamSize = { min: 3, max: 2 };
    expect(issuesOf(reversed)).toEqual([
      { code: 'team-size-order', path: ['format', 'teamSize'], min: 3, max: 2 },
    ]);
  });

  it('rejects blank and overlong texts', () => {
    const raw = rawConfig();
    raw.format.sides.con = '  ';
    raw.topics = [
      { id: 't1', text: '' },
      { id: 't2', text: 'x'.repeat(301) },
    ];
    expect(issuesOf(raw)).toEqual([
      { code: 'empty', path: ['format', 'sides', 'con'] },
      { code: 'empty', path: ['topics', 0, 'text'] },
      { code: 'too-long', path: ['topics', 1, 'text'], length: 301, max: 300 },
    ]);
  });

  it('rejects empty and overlong lists', () => {
    const empty = rawConfig();
    empty.format.steps = [];
    empty.topics = [];
    expect(issuesOf(empty)).toEqual([
      { code: 'too-few', path: ['format', 'steps'], count: 0, min: 1 },
      { code: 'too-few', path: ['topics'], count: 0, min: 1 },
    ]);

    const long = rawConfig();
    long.format.steps = Array.from({ length: 51 }, (_, i) => ({
      id: `s${i}`,
      type: 'consultation',
      seconds: 10,
      label: '',
    }));
    expect(issuesOf(long)).toEqual([
      { code: 'too-many', path: ['format', 'steps'], count: 51, max: 50 },
    ]);
  });

  it('rejects ids that could not serve as keys', () => {
    const raw = rawConfig();
    raw.format.steps[0].id = '__proto__';
    raw.format.steps[1].id = 'opening speech';
    raw.topics[0].id = '';
    expect(issuesOf(raw)).toEqual([
      { code: 'invalid-id', path: ['format', 'steps', 0, 'id'] },
      { code: 'invalid-id', path: ['format', 'steps', 1, 'id'] },
      { code: 'invalid-id', path: ['topics', 0, 'id'] },
    ]);
  });

  it('rejects duplicate ids', () => {
    const raw = rawConfig();
    raw.format.steps[3].id = 'opening';
    raw.topics = [
      { id: 't1', text: 'One' },
      { id: 't1', text: 'Two' },
    ];
    expect(issuesOf(raw)).toEqual([
      { code: 'duplicate-id', path: ['format', 'steps', 3, 'id'], id: 'opening' },
      { code: 'duplicate-id', path: ['topics', 1, 'id'], id: 't1' },
    ]);
  });

  it('allows one vote before and one vote after, in that order', () => {
    const twice = rawConfig();
    twice.format.steps.push({ id: 'again', type: 'vote-after', label: 'Again' });
    expect(issuesOf(twice)).toEqual([
      {
        code: 'duplicate-step-type',
        path: ['format', 'steps', 7, 'type'],
        stepType: 'vote-after',
      },
    ]);

    const reversed = rawConfig();
    reversed.format.steps.reverse();
    expect(issuesOf(reversed)).toEqual([{ code: 'vote-order', path: ['format', 'steps', 0] }]);
  });

  it('rejects values of the wrong type', () => {
    const raw = rawConfig();
    raw.format.sides = 'Pro and Contra' as never;
    raw.format.steps[1].label = 42;
    raw.format.steps[2] = 'consultation' as never;
    raw.topics = { t1: 'Homework' } as never;
    expect(issuesOf(raw)).toEqual([
      { code: 'wrong-type', path: ['format', 'sides'], expected: 'object' },
      { code: 'wrong-type', path: ['format', 'steps', 1, 'label'], expected: 'string' },
      { code: 'wrong-type', path: ['format', 'steps', 2], expected: 'object' },
      { code: 'wrong-type', path: ['topics'], expected: 'array' },
    ]);
  });
});

describe('parseConfig: cross-examination, audience questions and prep time (#8)', () => {
  it('reads a config without a prep-time bank, as from before #8, unchanged', () => {
    const raw = rawConfig();
    expect(configOf(raw)).toStrictEqual(raw);
    expect(Object.hasOwn(configOf(raw).format, 'prepTime')).toBe(false);
  });

  it('reads a prep-time bank of null as none', () => {
    const raw = rawConfig();
    raw.format.prepTime = null;
    expect(Object.hasOwn(configOf(raw).format, 'prepTime')).toBe(false);
  });

  it('keeps a prep-time bank, and only its known field', () => {
    const raw = rawConfig();
    raw.format.prepTime = { secondsPerTeam: 240, used: { pro: 30 } };
    expect(configOf(raw).format.prepTime).toStrictEqual({ secondsPerTeam: 240 });
  });

  const at = ['format', 'prepTime', 'secondsPerTeam'];

  it.each([
    [{}, { code: 'missing-field', path: at }],
    [{ secondsPerTeam: 0 }, { code: 'out-of-range', path: at, value: 0, min: 1, max: 3600 }],
    [{ secondsPerTeam: 3601 }, { code: 'out-of-range', path: at, value: 3601, min: 1, max: 3600 }],
    [{ secondsPerTeam: 1.5 }, { code: 'wrong-type', path: at, expected: 'integer' }],
    [{ secondsPerTeam: '240' }, { code: 'wrong-type', path: at, expected: 'integer' }],
    [240, { code: 'wrong-type', path: ['format', 'prepTime'], expected: 'object' }],
    ['4 minutes', { code: 'wrong-type', path: ['format', 'prepTime'], expected: 'object' }],
    [[240], { code: 'wrong-type', path: ['format', 'prepTime'], expected: 'object' }],
  ])('rejects the prep-time bank %j', (prepTime, issue) => {
    const raw = rawConfig();
    raw.format.prepTime = prepTime;
    expect(issuesOf(raw)).toEqual([issue]);
  });

  it('reports a broken prep-time bank along with the other problems', () => {
    const raw = rawConfig();
    raw.format.prepTime = { secondsPerTeam: -1 };
    raw.format.steps[1].seconds = 0;
    expect(issuesOf(raw).map((issue) => issue.path)).toEqual([
      ['format', 'prepTime', 'secondsPerTeam'],
      ['format', 'steps', 1, 'seconds'],
    ]);
  });

  it('requires the side that asks in a cross-examination, and its seconds', () => {
    const raw = rawConfig();
    delete raw.format.steps[4].askingSide;
    delete raw.format.steps[4].seconds;
    expect(issuesOf(raw)).toEqual([
      { code: 'missing-field', path: ['format', 'steps', 4, 'askingSide'] },
      { code: 'missing-field', path: ['format', 'steps', 4, 'seconds'] },
    ]);
  });

  it('rejects an unknown side that asks, or one that is not text', () => {
    const raw = rawConfig();
    raw.format.steps[4].askingSide = 'both';
    expect(issuesOf(raw)).toEqual([
      { code: 'unknown-side', path: ['format', 'steps', 4, 'askingSide'], side: 'both' },
    ]);
    raw.format.steps[4].askingSide = 1;
    expect(issuesOf(raw)).toEqual([
      { code: 'wrong-type', path: ['format', 'steps', 4, 'askingSide'], expected: 'string' },
    ]);
  });

  it('requires the seconds of audience questions, within the limits of any step', () => {
    const raw = rawConfig();
    delete raw.format.steps[5].seconds;
    expect(issuesOf(raw)).toEqual([
      { code: 'missing-field', path: ['format', 'steps', 5, 'seconds'] },
    ]);
    raw.format.steps[5].seconds = 3601;
    expect(issuesOf(raw)).toEqual([
      {
        code: 'out-of-range',
        path: ['format', 'steps', 5, 'seconds'],
        value: 3601,
        min: 1,
        max: 3600,
      },
    ]);
  });

  it('allows more than one cross-examination and more than one round of audience questions', () => {
    const raw = rawConfig();
    raw.format.steps.push(
      { id: 'cross-2', type: 'cross-examination', askingSide: 'pro', seconds: 180, label: 'CX' },
      { id: 'questions-2', type: 'audience-questions', seconds: 60, label: '' },
    );
    expect(issuesOf(raw)).toEqual([]);
  });
});
