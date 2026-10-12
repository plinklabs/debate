// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ConfigIssue, ConfigIssueCode } from '../model/validate';
import { parseConfigJson } from '../model/validate';
import { LOCALES } from '../model/locale';
import {
  DICTIONARIES,
  describeIssue,
  translator,
  type Dictionary,
  type MessageKey,
} from './dictionary';
import { en } from './en';
import { nl } from './nl';
import type { IssueOf } from './types';

/** One issue of every code, with numbers big enough to show the grouping. */
const SAMPLE_ISSUES: { readonly [C in ConfigIssueCode]: IssueOf<C> } = {
  'invalid-json': { code: 'invalid-json', path: [] },
  'newer-version': { code: 'newer-version', path: ['version'], found: 2, supported: 1 },
  'invalid-version': { code: 'invalid-version', path: ['version'] },
  'missing-field': { code: 'missing-field', path: ['format'] },
  'wrong-type': { code: 'wrong-type', path: ['topics'], expected: 'array' },
  'unknown-step-type': {
    code: 'unknown-step-type',
    path: ['format', 'steps', 0, 'type'],
    stepType: 'dance',
  },
  'unknown-side': { code: 'unknown-side', path: ['format', 'steps', 0, 'side'], side: 'left' },
  'out-of-range': {
    code: 'out-of-range',
    path: ['format', 'steps', 0, 'seconds'],
    value: 3601,
    min: 1,
    max: 3600,
  },
  empty: { code: 'empty', path: ['topics', 0, 'text'] },
  'too-long': { code: 'too-long', path: ['topics', 0, 'text'], length: 1200, max: 300 },
  'too-few': { code: 'too-few', path: ['topics'], count: 0, min: 1 },
  'too-many': { code: 'too-many', path: ['topics'], count: 1500, max: 100 },
  'invalid-id': { code: 'invalid-id', path: ['topics', 0, 'id'] },
  'duplicate-id': { code: 'duplicate-id', path: ['topics', 1, 'id'], id: 't1' },
  'duplicate-step-type': {
    code: 'duplicate-step-type',
    path: ['format', 'steps', 4, 'type'],
    stepType: 'vote-before',
  },
  'team-size-order': { code: 'team-size-order', path: ['format', 'teamSize'], min: 4, max: 2 },
  'vote-order': { code: 'vote-order', path: ['format', 'steps', 0] },
};

const ALL_ISSUES: readonly ConfigIssue[] = Object.values(SAMPLE_ISSUES);

describe('the dictionaries', () => {
  it('have the same keys in English and Dutch', () => {
    expect(Object.keys(nl).sort()).toEqual(Object.keys(en).sort());
  });

  it('do not compile with a key missing or a key too many', () => {
    const { 'app.name': _name, ...withoutName } = nl;
    // @ts-expect-error: a dictionary without 'app.name' is not a Dictionary.
    const missing: Dictionary = withoutName;
    // @ts-expect-error: a key that English does not have is not allowed.
    const extra: Dictionary = { ...nl, 'app.extra': 'Extra' };
    expect([missing, extra]).toHaveLength(2);
  });

  it.each(LOCALES)('have text for every plain message in %s', (locale) => {
    for (const [key, message] of Object.entries(DICTIONARIES[locale])) {
      if (typeof message === 'string') expect(message.trim(), key).not.toBe('');
    }
  });

  it('have every Dutch string translated, not copied from English', () => {
    // Keys whose text is rightly the same in both languages go here.
    const SAME_IN_BOTH: readonly MessageKey[] = [];
    const same = (Object.keys(en) as MessageKey[]).filter(
      (key) => typeof en[key] === 'string' && en[key] === nl[key],
    );
    expect(same).toEqual(SAME_IN_BOTH);
  });
});

describe('translator', () => {
  it('gives a plain message as it is', () => {
    expect(translator(en)('app.name')).toBe('Debate');
    expect(translator(nl)('app.name')).toBe('Debat');
  });

  it('fills in the parameters of a message', () => {
    const issue = SAMPLE_ISSUES['too-many'];
    expect(translator(en)('issue.too-many', issue)).toBe('Too many: 1,500, at most 100.');
    expect(translator(nl)('issue.too-many', issue)).toBe('Te veel: 1.500, hoogstens 100.');
  });
});

describe('describeIssue', () => {
  it.each(LOCALES)('describes every kind of problem in %s', (locale) => {
    const sentences = ALL_ISSUES.map((issue) => describeIssue(DICTIONARIES[locale], issue));
    for (const sentence of sentences) expect(sentence).toMatch(/^\S.*\.$/);
    // No two kinds of problem read the same.
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it('writes the numbers as the language does', () => {
    const issue = SAMPLE_ISSUES['out-of-range'];
    expect(describeIssue(en, issue)).toBe('3,601 is not between 1 and 3,600.');
    expect(describeIssue(nl, issue)).toBe('3.601 ligt niet tussen 1 en 3.600.');
  });

  it('names steps by their kind in the language', () => {
    const issue = SAMPLE_ISSUES['duplicate-step-type'];
    expect(describeIssue(en, issue)).toBe('There can be only one “Vote before” step.');
    expect(describeIssue(nl, issue)).toBe('Er mag maar één stap ‘Stemming vooraf’ zijn.');
  });

  it('describes what parseConfigJson finds', () => {
    const result = parseConfigJson(
      JSON.stringify({ version: 1, format: { sides: { pro: '', con: 'Con' } }, topics: [] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => describeIssue(nl, issue))).toEqual([
      'Dit mag niet leeg zijn.',
      'Dit veld ontbreekt.',
      'Dit veld ontbreekt.',
      'Te weinig: 0, minstens 1.',
    ]);
  });
});
