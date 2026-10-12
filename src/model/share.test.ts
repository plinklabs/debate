// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, LIMITS, type DebateConfig, type Step } from './config';
import { GRAFFITI_PRESET } from './presets';
import { initialState, reducer, type Action } from './reducer';
import {
  MAX_LINK_LENGTH,
  MAX_SETUP_BYTES,
  configFileText,
  decodeConfig,
  encodeConfig,
  linkTo,
  readConfigFile,
  readLinkHash,
} from './share';
import { base64Url, pack as packed, unpack as unpacked } from '../test/link';

const GRAFFITI_EN = GRAFFITI_PRESET.build('en');
const GRAFFITI_NL = GRAFFITI_PRESET.build('nl');

/** A deterministic stream of numbers in [0, 1), so a large test setup is the same every run. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

/** The largest setup `parseConfig` accepts, in text that hardly compresses (CJK characters). */
function largestConfig(): DebateConfig {
  const next = random(42);
  const text = (length: number) =>
    Array.from({ length }, () => String.fromCharCode(0x4e00 + Math.floor(next() * 20000))).join('');
  const steps: Step[] = Array.from({ length: LIMITS.steps.max }, (_, index) => ({
    id: `step-${index}-${'x'.repeat(LIMITS.idLength - 10)}`.slice(0, LIMITS.idLength),
    type: 'free-round',
    label: text(LIMITS.stepLabelLength),
    seconds: LIMITS.stepSeconds.max,
  }));
  return {
    version: CONFIG_VERSION,
    format: {
      sides: { pro: text(LIMITS.sideLabelLength), con: text(LIMITS.sideLabelLength) },
      teamSize: { min: 1, max: LIMITS.teamSize.max },
      steps,
    },
    topics: Array.from({ length: LIMITS.topics.max }, (_, index) => ({
      id: `topic-${index}-${'y'.repeat(LIMITS.idLength)}`.slice(0, LIMITS.idLength),
      text: text(LIMITS.topicLength),
    })),
  };
}

describe('a setup as a link', () => {
  it.each([
    ['English', GRAFFITI_EN],
    ['Dutch', GRAFFITI_NL],
  ])('comes back the same from the graffiti preset in %s', async (_, config) => {
    const encoded = await encodeConfig(config);
    expect(await decodeConfig(encoded)).toEqual({ ok: true, config });
  });

  it('is base64url of the deflated JSON, short enough to paste anywhere', async () => {
    const encoded = await encodeConfig(GRAFFITI_EN);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(JSON.parse(await unpacked(encoded))).toEqual(GRAFFITI_EN);
    // Five topics and ten steps: well under the length of the JSON itself.
    expect(encoded.length).toBeLessThan(800);
    expect(encoded.length).toBeLessThan(JSON.stringify(GRAFFITI_EN).length * 0.6);
  });

  it('fits the largest setup there can be, and brings it back', async () => {
    const config = largestConfig();
    const encoded = await encodeConfig(config);
    expect(encoded.length).toBeLessThan(MAX_LINK_LENGTH);
    expect(await decodeConfig(encoded)).toEqual({ ok: true, config });
  });

  it('keeps text in any script, and characters JSON must escape', async () => {
    const config: DebateConfig = {
      ...GRAFFITI_EN,
      topics: [
        { id: 't1', text: 'Kunst — “of” niet? 芸術 🎨 \\ "quoted" \u0007' },
        { id: 't2', text: 'Ça va: één, twee' },
      ],
    };
    expect(await decodeConfig(await encodeConfig(config))).toEqual({ ok: true, config });
  });

  it('refuses a config that is not valid: the app never holds one to share', async () => {
    const invalid = { ...GRAFFITI_EN, topics: [] } as DebateConfig;
    await expect(encodeConfig(invalid)).rejects.toThrow();
  });

  it('goes in the hash of the page it is shared from', () => {
    expect(linkTo('https://plinklabs.org/debate/', 'abc')).toBe(
      'https://plinklabs.org/debate/#c=abc',
    );
    expect(linkTo('https://plinklabs.org/debate/#c=old', 'new')).toBe(
      'https://plinklabs.org/debate/#c=new',
    );
    expect(linkTo('http://localhost:4173/debate/?x=1#', 'abc')).toBe(
      'http://localhost:4173/debate/?x=1#c=abc',
    );
  });

  it('is read from the hash, and only from a hash that holds one', () => {
    expect(readLinkHash('#c=abc-_1')).toBe('abc-_1');
    expect(readLinkHash('c=abc')).toBe('abc');
    expect(readLinkHash('#c=')).toBe('');
    expect(readLinkHash('')).toBeNull();
    expect(readLinkHash('#')).toBeNull();
    expect(readLinkHash('#top')).toBeNull();
    expect(readLinkHash('#cc=abc')).toBeNull();
  });
});

describe('a broken or foreign link', () => {
  const invalidLink = { ok: false, issues: [{ code: 'invalid-link', path: [] }] };
  const tooLarge = { ok: false, issues: [{ code: 'too-large', path: [] }] };

  it.each([
    ['empty', ''],
    ['not base64url', 'abc+/def='],
    ['spaces', 'abc def'],
    ['an impossible length', 'abcde'],
    ['not deflated', base64Url(new TextEncoder().encode('{"version":1}'))],
  ])('is reported as damaged when it is %s', async (_, encoded) => {
    expect(await decodeConfig(encoded)).toEqual(invalidLink);
  });

  it('is reported as damaged when it was cut short', async () => {
    const encoded = await encodeConfig(GRAFFITI_EN);
    expect(await decodeConfig(encoded.slice(0, -12))).toEqual(invalidLink);
    expect(await decodeConfig(encoded.slice(0, encoded.length / 2))).toEqual(invalidLink);
  });

  it('is reported as damaged when it does not unpack to text', async () => {
    const notUtf8 = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]);
    expect(await decodeConfig(await packed(notUtf8))).toEqual(invalidLink);
  });

  it('says the text is not a setup when it unpacks to something other than JSON', async () => {
    expect(await decodeConfig(await packed('Homework should be banned.'))).toEqual({
      ok: false,
      issues: [{ code: 'invalid-json', path: [] }],
    });
  });

  it('says what is wrong with the setup inside, as parseConfig does', async () => {
    const config = { ...GRAFFITI_EN, topics: [{ id: 't1', text: ' ' }] };
    expect(await decodeConfig(await packed(JSON.stringify(config)))).toEqual({
      ok: false,
      issues: [{ code: 'empty', path: ['topics', 0, 'text'] }],
    });
  });

  it('says so when a newer version of the app made it', async () => {
    const newer = { ...GRAFFITI_EN, version: CONFIG_VERSION + 1, rounds: [] };
    expect(await decodeConfig(await packed(JSON.stringify(newer)))).toEqual({
      ok: false,
      issues: [
        {
          code: 'newer-version',
          path: ['version'],
          found: CONFIG_VERSION + 1,
          supported: CONFIG_VERSION,
        },
      ],
    });
  });

  it('is too large when it is longer than any setup can be', async () => {
    expect(await decodeConfig('A'.repeat(MAX_LINK_LENGTH + 1))).toEqual(tooLarge);
  });

  it('is too large when a short link unpacks to more than a setup can be', async () => {
    const bomb = await packed(' '.repeat(MAX_SETUP_BYTES * 4));
    expect(bomb.length).toBeLessThan(20_000);
    expect(await decodeConfig(bomb)).toEqual(tooLarge);
  });
});

describe('a setup as a file', () => {
  it('is the config as pretty-printed JSON', () => {
    const text = configFileText(GRAFFITI_NL);
    expect(JSON.parse(text)).toEqual(GRAFFITI_NL);
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
    expect(text.startsWith('{\n  "version": 1,\n  "format": {\n')).toBe(true);
  });

  it.each([
    ['English', GRAFFITI_EN],
    ['Dutch', GRAFFITI_NL],
  ])('comes back the same from the graffiti preset in %s', async (_, config) => {
    const file = new Blob([configFileText(config)], { type: 'application/json' });
    expect(await readConfigFile(file)).toEqual({ ok: true, config });
  });

  it('is read with a byte order mark too, as some editors save it', async () => {
    const file = new Blob(['﻿', configFileText(GRAFFITI_EN)]);
    expect(await readConfigFile(file)).toEqual({ ok: true, config: GRAFFITI_EN });
  });

  it('says what is wrong with a file that is not a setup', async () => {
    expect(await readConfigFile(new Blob(['name,score\nAnn,7\n']))).toEqual({
      ok: false,
      issues: [{ code: 'invalid-json', path: [] }],
    });
    const newer = new Blob([JSON.stringify({ ...GRAFFITI_EN, version: 2 })]);
    expect(await readConfigFile(newer)).toMatchObject({
      ok: false,
      issues: [{ code: 'newer-version', found: 2 }],
    });
  });

  it('is too large when it is larger than any setup can be', async () => {
    const file = new Blob([' '.repeat(MAX_SETUP_BYTES + 1)]);
    expect(await readConfigFile(file)).toEqual({
      ok: false,
      issues: [{ code: 'too-large', path: [] }],
    });
  });
});

describe('what a link or a file can hold', () => {
  const NAMES = ['Annelies', 'Bertrand', 'Cassandra', 'Dirkjan', 'Evangeline'];

  /** A session in full swing: names on both teams, a vote counted, a timer run. */
  function classInSession() {
    const config = GRAFFITI_EN;
    const actions: Action[] = [
      { type: 'add-debate', topicId: 't1' },
      ...NAMES.slice(0, 3).map((name, slot): Action => ({
        type: 'set-name',
        debateId: 'd1',
        side: 'pro',
        slot,
        name,
      })),
      ...NAMES.slice(3).map((name, slot): Action => ({
        type: 'set-name',
        debateId: 'd1',
        side: 'con',
        slot,
        name,
      })),
      { type: 'open-debate', debateId: 'd1', now: 0 },
      { type: 'set-votes', side: 'pro', value: 17 },
      { type: 'next-step', now: 1000 },
      { type: 'toggle-timer', now: 2000 },
      { type: 'tap-speaker', side: 'pro', slot: 0, now: 2500 },
      { type: 'toggle-timer', now: 45_000 },
    ];
    const state = actions.reduce(reducer, initialState(config));
    // The session really holds the names and the results.
    const session = JSON.stringify(state.session);
    for (const name of NAMES) expect(session).toContain(name);
    expect(state.session.debates[0].records['vote-before']).toMatchObject({
      votes: { pro: 17 },
    });
    return state;
  }

  function expectNoSessionData(text: string) {
    for (const name of NAMES) expect(text).not.toContain(name);
    expect(text).not.toMatch(/debates|records|teams|votes|speakers|accMs/);
  }

  it('is the setup only, never the names or results of a session', async () => {
    const state = classInSession();
    const link = linkTo('https://plinklabs.org/debate/', await encodeConfig(state.config));
    const encoded = readLinkHash(new URL(link).hash) ?? '';
    expectNoSessionData(link);
    expectNoSessionData(await unpacked(encoded));
    expectNoSessionData(configFileText(state.config));
    expect(JSON.parse(await unpacked(encoded))).toEqual(GRAFFITI_EN);
  });

  it('drops whatever else an object passed as a config carries', async () => {
    const state = classInSession();
    // What the types forbid, done anyway: the session riding along on the config.
    const smuggled = {
      ...state.config,
      session: state.session,
      topics: state.config.topics.map((topic) => ({ ...topic, students: NAMES })),
    } as DebateConfig;
    expectNoSessionData(await unpacked(await encodeConfig(smuggled)));
    expectNoSessionData(configFileText(smuggled));
  });

  it('takes a config, not the app state with its session', async () => {
    const state = classInSession();
    // @ts-expect-error: the app state (setup plus session) is not a DebateConfig.
    await expect(encodeConfig(state)).rejects.toThrow();
    // @ts-expect-error: neither is the session.
    expect(() => configFileText(state.session)).toThrow();
  });
});
