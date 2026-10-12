// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatTotalSeconds, stepSeconds, stepSide, type DebateConfig } from './config';
import { LOCALES } from './locale';
import {
  DEFAULT_PRESET,
  GRAFFITI_PRESET,
  KARL_POPPER_PRESET,
  PRESETS,
  PUBLIC_DEBATE_PRESET,
  defaultConfig,
  findPreset,
} from './presets';
import { parseConfig } from './validate';

// The original app, verbatim from debat-logic.ts in yvanvds/cursus-esthetica
// (src/components/themes/graffiti-en-street-art/), without its display-only
// `who` column.
const ORIGINAL_STATEMENTS = [
  'Graffiti verliest haar betekenis zodra ze wordt toegestaan of gesubsidieerd.',
  'Wie zonder toestemming een muur beschildert, eist terecht de publieke ruimte op.',
  'Bedrijven die graffiti-esthetiek gebruiken, hollen haar betekenis uit.',
  'Een tag is evengoed kunst als een grote muurschildering.',
  'Een graffitiwerk hoort toe aan de maker, niet aan de eigenaar van de muur.',
];

// prettier-ignore
const ORIGINAL_STEPS = [
  { id: 'stemming-vooraf', kind: 'vote-before', label: 'Stemming vooraf', seconds: null, side: null },
  { id: 'opening-voor', kind: 'speech', label: 'Opening', seconds: 60, side: 'voor' },
  { id: 'opening-tegen', kind: 'speech', label: 'Opening', seconds: 60, side: 'tegen' },
  { id: 'overleg', kind: 'consult', label: 'Kort overleg', seconds: 60, side: null },
  { id: 'weerlegging-voor', kind: 'speech', label: 'Weerlegging', seconds: 90, side: 'voor' },
  { id: 'weerlegging-tegen', kind: 'speech', label: 'Weerlegging', seconds: 90, side: 'tegen' },
  { id: 'vrije-ronde', kind: 'free-round', label: 'Vrije ronde', seconds: 90, side: null },
  { id: 'slotwoord-tegen', kind: 'speech', label: 'Slotwoord', seconds: 30, side: 'tegen' },
  { id: 'slotwoord-voor', kind: 'speech', label: 'Slotwoord', seconds: 30, side: 'voor' },
  { id: 'stemming-achteraf', kind: 'vote-after', label: 'Stemming achteraf', seconds: null, side: null },
] as const;

const TYPE_OF_KIND = {
  'vote-before': 'vote-before',
  speech: 'speech',
  consult: 'consultation',
  'free-round': 'free-round',
  'vote-after': 'vote-after',
} as const;

const SIDE_OF = { voor: 'pro', tegen: 'con' } as const;

function stepRows(config: DebateConfig) {
  return config.format.steps.map((step) => ({
    type: step.type,
    label: step.label,
    seconds: stepSeconds(step),
    side: stepSide(step),
  }));
}

/** The config without anything that depends on the language. */
function withoutLabels(config: DebateConfig) {
  return {
    ...config,
    format: {
      ...config.format,
      sides: null,
      steps: config.format.steps.map((step) => ({ ...step, label: null })),
    },
  };
}

describe('graffiti preset', () => {
  it('reproduces the original step list: order, types, durations and sides', () => {
    expect(stepRows(GRAFFITI_PRESET.build('nl'))).toEqual(
      ORIGINAL_STEPS.map((step) => ({
        type: TYPE_OF_KIND[step.kind],
        label: step.label,
        seconds: step.seconds,
        side: step.side === null ? null : SIDE_OF[step.side],
      })),
    );
  });

  it('runs the closing statements against before for', () => {
    const speeches = GRAFFITI_PRESET.build('en').format.steps.filter(
      (step) => step.type === 'speech',
    );
    expect(speeches.slice(-2).map((step) => [step.id, stepSide(step), stepSeconds(step)])).toEqual([
      ['closing-con', 'con', 30],
      ['closing-pro', 'pro', 30],
    ]);
  });

  it('has the original statements verbatim, in Dutch in every locale', () => {
    for (const locale of LOCALES) {
      const topics = GRAFFITI_PRESET.build(locale).topics;
      expect(topics.map((topic) => topic.text)).toEqual(ORIGINAL_STATEMENTS);
    }
  });

  it('keeps teams of two or three, called VOOR and TEGEN in Dutch', () => {
    const nl = GRAFFITI_PRESET.build('nl').format;
    expect(nl.teamSize).toEqual({ min: 2, max: 3 });
    expect(nl.sides).toEqual({ pro: 'VOOR', con: 'TEGEN' });
    expect(GRAFFITI_PRESET.build('en').format.sides).toEqual({ pro: 'FOR', con: 'AGAINST' });
  });

  it('has English labels', () => {
    expect(stepRows(GRAFFITI_PRESET.build('en')).map((row) => row.label)).toEqual([
      'Vote before',
      'Opening',
      'Opening',
      'Short consultation',
      'Rebuttal',
      'Rebuttal',
      'Free round',
      'Closing statement',
      'Closing statement',
      'Vote after',
    ]);
  });

  it('is the default', () => {
    expect(DEFAULT_PRESET).toBe(GRAFFITI_PRESET);
    expect(defaultConfig('nl')).toEqual(GRAFFITI_PRESET.build('nl'));
    expect(findPreset('graffiti')).toBe(GRAFFITI_PRESET);
    expect(findPreset('nope')).toBeUndefined();
  });
});

describe('Karl Popper preset', () => {
  // "The Karl Popper Debate Format", Debate Central, University of Vermont
  // (presets.ts): who speaks or asks, and for how many minutes.
  const SOURCE = [
    ['speech', 'pro', 6], // affirmative speech, student 1
    ['cross-examination', 'con', 3], // negative cross-examination, student 3
    ['speech', 'con', 6], // negative speech, student 1
    ['cross-examination', 'pro', 3], // affirmative cross-examination, student 3
    ['speech', 'pro', 5], // affirmative speech, student 2
    ['cross-examination', 'con', 3], // negative cross-examination, student 1
    ['speech', 'con', 5], // negative speech, student 2
    ['cross-examination', 'pro', 3], // affirmative cross-examination, student 1
    ['speech', 'pro', 5], // affirmative speech and closing remarks, student 3
    ['speech', 'con', 5], // negative speech and closing remarks, student 3
  ] as const;

  it('has the speeches and cross-examinations of the source, in order and on time', () => {
    const steps = KARL_POPPER_PRESET.build('en').format.steps;
    expect(steps.map((step) => [step.type, stepSide(step), (stepSeconds(step) ?? 0) / 60])).toEqual(
      SOURCE,
    );
  });

  it('gives each team a bank of 4 minutes of prep time, three students a side, and no vote', () => {
    const { format } = KARL_POPPER_PRESET.build('nl');
    expect(format.prepTime).toEqual({ secondsPerTeam: 240 });
    expect(format.teamSize).toEqual({ min: 3, max: 3 });
    expect(format.steps.some((step) => step.type.startsWith('vote'))).toBe(false);
    // 44 minutes of speaking and questions, and 4 minutes for each team to prepare.
    expect(formatTotalSeconds(format)).toBe((44 + 8) * 60);
  });

  it('calls its sides affirmative and negative, in either language', () => {
    expect(KARL_POPPER_PRESET.build('en').format.sides).toEqual({
      pro: 'AFFIRMATIVE',
      con: 'NEGATIVE',
    });
    expect(KARL_POPPER_PRESET.build('nl').format.sides).toEqual({
      pro: 'BEVESTIGEND',
      con: 'ONTKENNEND',
    });
    expect(KARL_POPPER_PRESET.build('nl').format.steps[1].label).toBe('Kruisverhoor');
  });

  it('can be found by its id', () => {
    expect(findPreset('karl-popper')).toBe(KARL_POPPER_PRESET);
  });
});

describe('public debate preset', () => {
  it('opens and closes with the audience vote, with questions from the audience in between', () => {
    const { format } = PUBLIC_DEBATE_PRESET.build('en');
    expect(format.steps.map((step) => [step.type, stepSide(step), stepSeconds(step)])).toEqual([
      ['vote-before', null, null],
      ['speech', 'pro', 7 * 60],
      ['speech', 'con', 7 * 60],
      ['audience-questions', null, 10 * 60],
      ['speech', 'pro', 2 * 60],
      ['speech', 'con', 2 * 60],
      ['vote-after', null, null],
    ]);
    expect(formatTotalSeconds(format)).toBe(28 * 60);
  });

  it('has two debaters a side, no prep-time bank, and Dutch labels in Dutch', () => {
    const { format } = PUBLIC_DEBATE_PRESET.build('nl');
    expect(format.teamSize).toEqual({ min: 2, max: 2 });
    expect(Object.hasOwn(format, 'prepTime')).toBe(false);
    expect(format.sides).toEqual({ pro: 'VOOR', con: 'TEGEN' });
    expect(format.steps[3].label).toBe('Vragen uit het publiek');
    expect(PUBLIC_DEBATE_PRESET.name).toEqual({ en: 'Public debate', nl: 'Publiek debat' });
  });

  it('can be found by its id', () => {
    expect(findPreset('public-debate')).toBe(PUBLIC_DEBATE_PRESET);
  });
});

describe('the presets', () => {
  it('are the graffiti debate, Karl Popper and the public debate, each with its own id', () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual([
      'graffiti',
      'karl-popper',
      'public-debate',
    ]);
  });
});

describe.each(PRESETS.map((preset) => [preset.id, preset] as const))('preset %s', (_, preset) => {
  it.each(LOCALES)('is a valid config in %s, with every label filled in', (locale) => {
    const config = preset.build(locale);
    expect(parseConfig(config)).toEqual({ ok: true, config });
    expect(preset.name[locale].trim()).not.toBe('');
    expect(Object.values(config.format.sides).every((label) => label.trim() !== '')).toBe(true);
    expect(config.format.steps.every((step) => step.label.trim() !== '')).toBe(true);
  });

  it('differs between locales in its labels only', () => {
    const [first, ...others] = LOCALES.map((locale) => withoutLabels(preset.build(locale)));
    for (const other of others) expect(other).toEqual(first);
  });
});
