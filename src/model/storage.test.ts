// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { DebateConfig } from './config';
import { GRAFFITI_PRESET, KARL_POPPER_PRESET, PUBLIC_DEBATE_PRESET } from './presets';
import {
  anyRunning,
  currentDebate,
  initialState,
  reducer,
  type Action,
  type AppState,
} from './reducer';
import { NO_PREP, recordFor, type Debate } from './session';
import {
  STORAGE_KEY,
  deserializeState,
  loadState,
  saveState,
  serializeState,
  type KeyValueStore,
} from './storage';
import { elapsedMs } from './timer';

const config = GRAFFITI_PRESET.build('en');
const fallback = GRAFFITI_PRESET.build('nl');

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const store: KeyValueStore = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
  return { data, open: () => store };
}

function apply(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}

function step(id: string) {
  const found = config.format.steps.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no step ${id}`);
  return found;
}

function onlyDebate(state: AppState): Debate {
  expect(state.session.debates).toHaveLength(1);
  return state.session.debates[0];
}

/** One debate in the free round, its for clock running since second 302. */
function midDebate(): AppState {
  return apply(
    initialState(config),
    { type: 'add-debate', topicId: 't2' },
    { type: 'set-name', debateId: 'd1', side: 'pro', slot: 0, name: 'Ann' },
    { type: 'set-name', debateId: 'd1', side: 'pro', slot: 1, name: 'Bert' },
    { type: 'set-name', debateId: 'd1', side: 'con', slot: 0, name: 'Cas' },
    { type: 'set-name', debateId: 'd1', side: 'con', slot: 1, name: 'Dirk' },
    { type: 'open-debate', debateId: 'd1', now: 0 },
    { type: 'set-votes', side: 'pro', value: 12 },
    { type: 'next-step', now: 1000 },
    { type: 'tap-speaker', side: 'pro', slot: 1, now: 2000 },
    { type: 'go-to-step', step: 6, now: 62_000 },
    { type: 'tap-speaker', side: 'con', slot: 0, now: 100_000 },
    { type: 'tap-speaker', side: 'pro', slot: 0, now: 302_000 },
  );
}

describe('a reload', () => {
  it('brings the session back with every timer paused at its elapsed time', () => {
    const store = memoryStore();
    const before = midDebate();
    expect(anyRunning(before)).toBe(true);

    // The page is closed 10 seconds into the for team's turn...
    expect(saveState(store.open, before, 312_000)).toBe(true);
    // ...and reopened: performance.now() starts again from 0.
    const after = loadState(store.open, fallback);

    expect(after.config).toEqual(config);
    expect(anyRunning(after)).toBe(false);
    expect(currentDebate(after)).toMatchObject({ stepIndex: 6, step: { id: 'free-round' } });

    const debate = onlyDebate(after);
    expect(debate.teams).toEqual({ pro: ['Ann', 'Bert', ''], con: ['Cas', 'Dirk', ''] });
    expect(recordFor(debate, step('vote-before'))).toEqual({
      type: 'vote-before',
      votes: { pro: 12, con: 0 },
    });
    expect(recordFor(debate, step('opening-pro'))).toEqual({
      type: 'speech',
      timer: { accMs: 60_000, since: null },
      speakers: [1],
      current: 1,
    });
    expect(recordFor(debate, step('free-round'))).toEqual({
      type: 'free-round',
      clocks: { pro: { accMs: 10_000, since: null }, con: { accMs: 202_000, since: null } },
      active: null,
      lastSide: 'pro',
      current: { side: 'pro', slot: 0 },
      teamTurns: { pro: 1, con: 1 },
      speakerTurns: { pro: [1], con: [1] },
    });

    // Start resumes the team that had the floor, on the new page's clock.
    const resumed = reducer(after, { type: 'toggle-timer', now: 50 });
    const round = recordFor(onlyDebate(resumed), step('free-round'));
    expect(round.type === 'free-round' && elapsedMs(round.clocks.pro, 1050)).toBe(11_000);
  });

  it('never stores a running timer', () => {
    const json = serializeState(midDebate(), 312_000);
    expect(json).not.toMatch(/"since":\d/);
  });

  it('uses a versioned key', () => {
    const store = memoryStore();
    saveState(store.open, midDebate(), 0);
    expect([...store.data.keys()]).toEqual([STORAGE_KEY]);
    expect(STORAGE_KEY).toMatch(/:v1$/);
  });
});

describe('loading', () => {
  it('starts fresh when nothing is stored', () => {
    expect(loadState(memoryStore().open, fallback)).toEqual(initialState(fallback));
  });

  it.each([
    ['not JSON', '{"version":'],
    ['another version', JSON.stringify({ version: 2, config, session: {} })],
    ['not an object', '[]'],
  ])('starts fresh when the stored state is %s', (_, raw) => {
    const store = memoryStore({ [STORAGE_KEY]: raw });
    expect(loadState(store.open, fallback)).toEqual(initialState(fallback));
  });

  it('starts fresh when storage is blocked', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    expect(loadState(blocked, fallback)).toEqual(initialState(fallback));
    expect(saveState(blocked, midDebate(), 0)).toBe(false);

    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveState(() => full, midDebate(), 0)).toBe(false);
  });

  it('keeps the session when the stored setup no longer validates', () => {
    const stored = JSON.parse(serializeState(midDebate(), 312_000));
    stored.config.format.steps[1].seconds = 0;
    const state = deserializeState(JSON.stringify(stored), fallback);
    expect(state?.config).toBe(fallback);
    expect(state?.session.debates.map((debate) => debate.id)).toEqual(['d1']);
  });

  it('drops what does not have the expected shape, and keeps the rest', () => {
    const raw = JSON.stringify({
      version: 1,
      config,
      session: {
        current: 'd9',
        debates: [
          {
            id: 'd1',
            topicId: 't1',
            teams: {
              pro: ['Ann', 7, 'Bert', 'Cas', 'x'.repeat(60), '', '', '', 'Extra'],
              con: 'Dirk',
            },
            step: -4,
            done: 'yes',
            records: {
              'opening-pro': {
                type: 'speech',
                timer: { accMs: -5, since: 123 },
                speakers: [0, 0, 2, 99, 'Ann'],
                current: 7,
              },
              'vote-before': { type: 'vote-before', votes: { pro: 4000, con: -2 } },
              'vote-after': { type: 'jury', scores: [] },
              'bad key': { type: 'consultation', timer: { accMs: 1000 } },
              constructor: 'nonsense',
            },
          },
          { id: 'd1', topicId: 't2' },
          { id: '../d2', topicId: 't2' },
          { id: 'd3' },
          'd4',
        ],
      },
    });

    const state = deserializeState(raw, fallback);
    expect(state?.session.current).toBeNull();
    expect(state?.session.debates).toEqual([
      {
        id: 'd1',
        topicId: 't1',
        teams: { pro: ['Ann', '', 'Bert', 'Cas', 'x'.repeat(40), '', '', ''], con: [] },
        step: 0,
        done: false,
        records: {
          'opening-pro': {
            type: 'speech',
            timer: { accMs: 0, since: null },
            speakers: [0, 2],
            current: null,
          },
          'vote-before': { type: 'vote-before', votes: { pro: 999, con: 0 } },
        },
        prep: NO_PREP,
      },
    ]);
  });

  it('cannot be used to change the prototype of a record map', () => {
    const raw = `{"version":1,"session":{"debates":[{"id":"d1","topicId":"t1","records":{"__proto__":{"type":"consultation","timer":{"accMs":1}}}}]}}`;
    const records = deserializeState(raw, fallback)?.session.debates[0].records;
    expect(records).toEqual({});
    expect(Object.getPrototypeOf(records)).toBe(Object.prototype);
  });
});

describe('a stored config', () => {
  it('goes through the same validation as a link or a file', () => {
    const custom: DebateConfig = {
      ...config,
      topics: [{ id: 'own', text: 'Phones belong in the classroom.' }],
    };
    const store = memoryStore();
    saveState(store.open, initialState(custom), 0);
    expect(loadState(store.open, fallback).config).toEqual(custom);
  });
});

describe('the steps and prep time of #8', () => {
  const popper = KARL_POPPER_PRESET.build('en');
  const team = (debateId: string, side: 'pro' | 'con', names: string[]): Action[] =>
    names.map((name, slot) => ({ type: 'set-name', debateId, side, slot, name }));

  it('come back from a reload as they were, the prep time paused at its elapsed time', () => {
    const s = apply(
      initialState(popper),
      { type: 'add-debate', topicId: 't1' },
      ...team('d1', 'pro', ['Ann', 'Bert', 'Cas']),
      ...team('d1', 'con', ['Dirk', 'Eva', 'Fien']),
      { type: 'open-debate', debateId: 'd1', now: 0 },
      { type: 'go-to-step', step: 1, now: 0 },
      { type: 'tap-speaker', side: 'con', slot: 2, now: 0 },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: 1000 },
      { type: 'toggle-prep', side: 'con', now: 20_000 },
    );
    const restored = deserializeState(serializeState(s, 50_000), fallback);
    if (restored === null) throw new Error('nothing restored');
    const debate = onlyDebate(restored);
    expect(debate.prep).toEqual({
      clocks: { pro: { accMs: 0, since: null }, con: { accMs: 30_000, since: null } },
      active: null,
    });
    expect(debate.records['cross-examination-con-1']).toEqual({
      type: 'cross-examination',
      timer: { accMs: 20_000, since: null },
      askers: [2],
      answerers: [0],
      asker: 2,
      answerer: 0,
    });
    expect(restored.config).toEqual(popper);
  });

  it('keeps the answers counted in audience questions', () => {
    const config = PUBLIC_DEBATE_PRESET.build('en');
    const s = apply(
      initialState(config),
      { type: 'add-debate', topicId: 't1' },
      ...team('d1', 'pro', ['Ann', 'Bert']),
      ...team('d1', 'con', ['Dirk', 'Eva']),
      { type: 'open-debate', debateId: 'd1', now: 0 },
      { type: 'go-to-step', step: 3, now: 0 },
      { type: 'toggle-timer', now: 0 },
      { type: 'adjust-answers', side: 'con', delta: 1 },
    );
    const restored = deserializeState(serializeState(s, 9000), fallback);
    expect(restored?.session.debates[0].records['audience-questions']).toEqual({
      type: 'audience-questions',
      timer: { accMs: 9000, since: null },
      answers: { pro: 0, con: 1 },
    });
  });

  it('reads a debate stored before #8 as one without prep time', () => {
    const raw = JSON.stringify({
      version: 1,
      config,
      session: { debates: [{ id: 'd1', topicId: 't1', records: {} }], current: null },
    });
    expect(deserializeState(raw, fallback)?.session.debates[0].prep).toEqual(NO_PREP);
  });

  it('drops what does not fit in the new records and in the prep time', () => {
    const raw = JSON.stringify({
      version: 1,
      config: popper,
      session: {
        debates: [
          {
            id: 'd1',
            topicId: 't1',
            prep: { clocks: { pro: { accMs: -3 }, con: 'lots' }, active: 'pro' },
            records: {
              'cross-examination-con-1': {
                type: 'cross-examination',
                timer: { accMs: 4000, since: 7 },
                askers: [1, 1, 'Eva', 12],
                answerers: 'Ann',
                asker: 0,
                answerer: 1,
              },
              questions: { type: 'audience-questions', answers: { pro: -2, con: 3.7 } },
            },
          },
        ],
      },
    });
    const debate = deserializeState(raw, fallback)?.session.debates[0];
    expect(debate?.prep).toEqual(NO_PREP);
    expect(debate?.records).toEqual({
      'cross-examination-con-1': {
        type: 'cross-examination',
        timer: { accMs: 4000, since: null },
        askers: [1],
        answerers: [],
        asker: null,
        answerer: null,
      },
      questions: {
        type: 'audience-questions',
        timer: { accMs: 0, since: null },
        answers: { pro: 0, con: 3 },
      },
    });
  });
});
