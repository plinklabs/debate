// Checks a config that comes from outside the app (a link or a file, #5)
// before it is used. Parsing builds a fresh config from the known fields only,
// so anything else in the input (stray fields, names that do not belong in a
// config) is dropped.
//
// Problems come back as data, not as sentences: a code, the path to the field
// and the numbers that matter, so a UI can say it in the reader's language.
// All problems are collected, not only the first one.

import {
  CONFIG_VERSION,
  LIMITS,
  SIDES,
  isStepType,
  isValidId,
  type DebateConfig,
  type Format,
  type Side,
  type Step,
  type StepType,
  type TeamSize,
  type Topic,
} from './config';

/** Where a problem is: field names and array indexes from the root, e.g. `['format', 'steps', 3, 'seconds']`. */
export type IssuePath = readonly (string | number)[];

export type ValueType = 'object' | 'array' | 'string' | 'integer';

export type ConfigIssue =
  /** The text is not JSON at all. */
  | { readonly code: 'invalid-json'; readonly path: IssuePath }
  /** A link whose setup cannot be unpacked: cut short, or not made by this app (share.ts). */
  | { readonly code: 'invalid-link'; readonly path: IssuePath }
  /** A link or a file larger than any setup can be (share.ts). */
  | { readonly code: 'too-large'; readonly path: IssuePath }
  /** A file that holds no saved session this app can read: not a report it made (reportFile.ts). */
  | { readonly code: 'not-a-report'; readonly path: IssuePath }
  /** Made by a newer version of the app. */
  | {
      readonly code: 'newer-version';
      readonly path: IssuePath;
      readonly found: number;
      readonly supported: number;
    }
  | { readonly code: 'invalid-version'; readonly path: IssuePath }
  | { readonly code: 'missing-field'; readonly path: IssuePath }
  | { readonly code: 'wrong-type'; readonly path: IssuePath; readonly expected: ValueType }
  | { readonly code: 'unknown-step-type'; readonly path: IssuePath; readonly stepType: string }
  | { readonly code: 'unknown-side'; readonly path: IssuePath; readonly side: string }
  | {
      readonly code: 'out-of-range';
      readonly path: IssuePath;
      readonly value: number;
      readonly min: number;
      readonly max: number;
    }
  /** A text that must not be blank is blank. */
  | { readonly code: 'empty'; readonly path: IssuePath }
  | {
      readonly code: 'too-long';
      readonly path: IssuePath;
      readonly length: number;
      readonly max: number;
    }
  | {
      readonly code: 'too-few';
      readonly path: IssuePath;
      readonly count: number;
      readonly min: number;
    }
  | {
      readonly code: 'too-many';
      readonly path: IssuePath;
      readonly count: number;
      readonly max: number;
    }
  /** Ids are letters, digits and dashes (see `isValidId`). */
  | { readonly code: 'invalid-id'; readonly path: IssuePath }
  | { readonly code: 'duplicate-id'; readonly path: IssuePath; readonly id: string }
  /** A second vote before, or a second vote after. */
  | { readonly code: 'duplicate-step-type'; readonly path: IssuePath; readonly stepType: StepType }
  /** Minimum team size above the maximum. */
  | {
      readonly code: 'team-size-order';
      readonly path: IssuePath;
      readonly min: number;
      readonly max: number;
    }
  /** The vote after comes before the vote before. */
  | { readonly code: 'vote-order'; readonly path: IssuePath };

export type ConfigIssueCode = ConfigIssue['code'];

export type ConfigResult =
  | { readonly ok: true; readonly config: DebateConfig }
  | { readonly ok: false; readonly issues: readonly ConfigIssue[] };

/** Validate a config that has already been decoded from JSON. */
export function parseConfig(input: unknown): ConfigResult {
  const issues: ConfigIssue[] = [];
  if (!isObject(input)) {
    return { ok: false, issues: [{ code: 'wrong-type', path: [], expected: 'object' }] };
  }
  // A config of another version may have a different shape altogether: stop here.
  if (!checkVersion(input, issues)) return { ok: false, issues };

  const format = readFormat(input, issues);
  const topics = readTopics(input, issues);
  if (format === undefined || topics === undefined || issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, config: { version: CONFIG_VERSION, format, topics } };
}

/** Validate a config given as JSON text, as in a file or a decoded link. */
export function parseConfigJson(text: string): ConfigResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ code: 'invalid-json', path: [] }] };
  }
  return parseConfig(data);
}

// ---------------------------------------------------------------------------
// Readers. Each one returns the value when it is valid, and otherwise records
// what is wrong and returns `undefined`.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;
type Issues = ConfigIssue[];

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkVersion(root: Json, issues: Issues): boolean {
  const version = field(root, 'version', [], issues);
  if (version === undefined) return false;
  if (version === CONFIG_VERSION) return true;
  if (typeof version === 'number' && Number.isInteger(version) && version > CONFIG_VERSION) {
    issues.push({
      code: 'newer-version',
      path: ['version'],
      found: version,
      supported: CONFIG_VERSION,
    });
  } else {
    issues.push({ code: 'invalid-version', path: ['version'] });
  }
  return false;
}

/** The value of a required field; a missing one is recorded. `null` counts as present. */
function field(parent: Json, key: string, path: IssuePath, issues: Issues): unknown {
  const value = Object.hasOwn(parent, key) ? parent[key] : undefined;
  if (value === undefined) issues.push({ code: 'missing-field', path: [...path, key] });
  return value;
}

function readObject(parent: Json, key: string, path: IssuePath, issues: Issues): Json | undefined {
  const value = field(parent, key, path, issues);
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    issues.push({ code: 'wrong-type', path: [...path, key], expected: 'object' });
    return undefined;
  }
  return value;
}

function readList(
  parent: Json,
  key: string,
  path: IssuePath,
  issues: Issues,
  bounds: { readonly min: number; readonly max: number },
): unknown[] | undefined {
  const value = field(parent, key, path, issues);
  if (value === undefined) return undefined;
  const at = [...path, key];
  if (!Array.isArray(value)) {
    issues.push({ code: 'wrong-type', path: at, expected: 'array' });
    return undefined;
  }
  if (value.length < bounds.min) {
    issues.push({ code: 'too-few', path: at, count: value.length, min: bounds.min });
    return undefined;
  }
  if (value.length > bounds.max) {
    issues.push({ code: 'too-many', path: at, count: value.length, max: bounds.max });
    return undefined;
  }
  return value;
}

function readText(
  parent: Json,
  key: string,
  path: IssuePath,
  issues: Issues,
  rules: { readonly max: number; readonly blank: 'allowed' | 'not-allowed' },
): string | undefined {
  const value = field(parent, key, path, issues);
  if (value === undefined) return undefined;
  const at = [...path, key];
  if (typeof value !== 'string') {
    issues.push({ code: 'wrong-type', path: at, expected: 'string' });
    return undefined;
  }
  if (rules.blank === 'not-allowed' && value.trim() === '') {
    issues.push({ code: 'empty', path: at });
    return undefined;
  }
  if (value.length > rules.max) {
    issues.push({ code: 'too-long', path: at, length: value.length, max: rules.max });
    return undefined;
  }
  return value;
}

function readInteger(
  parent: Json,
  key: string,
  path: IssuePath,
  issues: Issues,
  range: { readonly min: number; readonly max: number },
): number | undefined {
  const value = field(parent, key, path, issues);
  if (value === undefined) return undefined;
  const at = [...path, key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    issues.push({ code: 'wrong-type', path: at, expected: 'integer' });
    return undefined;
  }
  if (value < range.min || value > range.max) {
    issues.push({ code: 'out-of-range', path: at, value, min: range.min, max: range.max });
    return undefined;
  }
  return value;
}

function readId(parent: Json, key: string, path: IssuePath, issues: Issues): string | undefined {
  const value = field(parent, key, path, issues);
  if (value === undefined) return undefined;
  const at = [...path, key];
  if (typeof value !== 'string') {
    issues.push({ code: 'wrong-type', path: at, expected: 'string' });
    return undefined;
  }
  if (!isValidId(value)) {
    issues.push({ code: 'invalid-id', path: at });
    return undefined;
  }
  return value;
}

function readSide(parent: Json, key: string, path: IssuePath, issues: Issues): Side | undefined {
  const value = field(parent, key, path, issues);
  if (value === undefined) return undefined;
  const at = [...path, key];
  if (typeof value !== 'string') {
    issues.push({ code: 'wrong-type', path: at, expected: 'string' });
    return undefined;
  }
  const side = SIDES.find((candidate) => candidate === value);
  if (side === undefined) issues.push({ code: 'unknown-side', path: at, side: value });
  return side;
}

/**
 * Report each id that was already used earlier in the list. Items that were
 * invalid on their own are `undefined` here, so indexes stay those of the input.
 */
function checkUniqueIds(
  items: readonly ({ readonly id: string } | undefined)[],
  path: IssuePath,
  issues: Issues,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (item === undefined) return;
    if (seen.has(item.id)) {
      issues.push({ code: 'duplicate-id', path: [...path, index, 'id'], id: item.id });
    }
    seen.add(item.id);
  });
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

function readFormat(root: Json, issues: Issues): Format | undefined {
  const format = readObject(root, 'format', [], issues);
  if (format === undefined) return undefined;
  const path = ['format'];
  const sides = readSides(format, path, issues);
  const teamSize = readTeamSize(format, path, issues);
  const steps = readSteps(format, path, issues);
  if (sides === undefined || teamSize === undefined || steps === undefined) return undefined;
  return { sides, teamSize, steps };
}

function readSides(
  format: Json,
  path: IssuePath,
  issues: Issues,
): Readonly<Record<Side, string>> | undefined {
  const sides = readObject(format, 'sides', path, issues);
  if (sides === undefined) return undefined;
  const at = [...path, 'sides'];
  const rules = { max: LIMITS.sideLabelLength, blank: 'not-allowed' } as const;
  const pro = readText(sides, 'pro', at, issues, rules);
  const con = readText(sides, 'con', at, issues, rules);
  return pro === undefined || con === undefined ? undefined : { pro, con };
}

function readTeamSize(format: Json, path: IssuePath, issues: Issues): TeamSize | undefined {
  const size = readObject(format, 'teamSize', path, issues);
  if (size === undefined) return undefined;
  const at = [...path, 'teamSize'];
  const min = readInteger(size, 'min', at, issues, LIMITS.teamSize);
  const max = readInteger(size, 'max', at, issues, LIMITS.teamSize);
  if (min === undefined || max === undefined) return undefined;
  if (min > max) {
    issues.push({ code: 'team-size-order', path: at, min, max });
    return undefined;
  }
  return { min, max };
}

function readSteps(format: Json, path: IssuePath, issues: Issues): Step[] | undefined {
  const list = readList(format, 'steps', path, issues, LIMITS.steps);
  if (list === undefined) return undefined;
  const at = [...path, 'steps'];
  const before = issues.length;
  const steps = list.map((item, index) => readStep(item, [...at, index], issues));

  checkUniqueIds(steps, at, issues);

  // The vote shift compares one vote before with one vote after.
  const firstOf = new Map<StepType, number>();
  steps.forEach((step, index) => {
    if (step === undefined || (step.type !== 'vote-before' && step.type !== 'vote-after')) return;
    if (firstOf.has(step.type)) {
      issues.push({
        code: 'duplicate-step-type',
        path: [...at, index, 'type'],
        stepType: step.type,
      });
    } else {
      firstOf.set(step.type, index);
    }
  });
  const voteBefore = firstOf.get('vote-before');
  const voteAfter = firstOf.get('vote-after');
  if (voteBefore !== undefined && voteAfter !== undefined && voteAfter < voteBefore) {
    issues.push({ code: 'vote-order', path: [...at, voteAfter] });
  }

  return issues.length > before ? undefined : steps.filter(isDefined);
}

function readStep(value: unknown, path: IssuePath, issues: Issues): Step | undefined {
  if (!isObject(value)) {
    issues.push({ code: 'wrong-type', path, expected: 'object' });
    return undefined;
  }
  const id = readId(value, 'id', path, issues);
  const type = readStepType(value, path, issues);
  // A blank label is allowed: the UI can show the name of the step type instead.
  const label = readText(value, 'label', path, issues, {
    max: LIMITS.stepLabelLength,
    blank: 'allowed',
  });
  if (type === undefined) return undefined;

  // Fields that only some types have are read, and required, per type. Fields
  // that do not belong to the type are ignored.
  switch (type) {
    case 'speech': {
      const side = readSide(value, 'side', path, issues);
      const seconds = readInteger(value, 'seconds', path, issues, LIMITS.stepSeconds);
      if (id === undefined || label === undefined || side === undefined) return undefined;
      if (seconds === undefined) return undefined;
      return { id, type, label, side, seconds };
    }
    case 'consultation':
    case 'free-round': {
      const seconds = readInteger(value, 'seconds', path, issues, LIMITS.stepSeconds);
      if (id === undefined || label === undefined || seconds === undefined) return undefined;
      return { id, type, label, seconds };
    }
    case 'vote-before':
    case 'vote-after':
      if (id === undefined || label === undefined) return undefined;
      return { id, type, label };
  }
}

function readStepType(step: Json, path: IssuePath, issues: Issues): StepType | undefined {
  const value = field(step, 'type', path, issues);
  if (value === undefined) return undefined;
  const at = [...path, 'type'];
  if (typeof value !== 'string') {
    issues.push({ code: 'wrong-type', path: at, expected: 'string' });
    return undefined;
  }
  if (!isStepType(value)) {
    issues.push({ code: 'unknown-step-type', path: at, stepType: value });
    return undefined;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

function readTopics(root: Json, issues: Issues): Topic[] | undefined {
  const list = readList(root, 'topics', [], issues, LIMITS.topics);
  if (list === undefined) return undefined;
  const at = ['topics'];
  const before = issues.length;
  const topics = list.map((item, index) => readTopic(item, [...at, index], issues));
  checkUniqueIds(topics, at, issues);
  return issues.length > before ? undefined : topics.filter(isDefined);
}

function readTopic(value: unknown, path: IssuePath, issues: Issues): Topic | undefined {
  if (!isObject(value)) {
    issues.push({ code: 'wrong-type', path, expected: 'object' });
    return undefined;
  }
  const id = readId(value, 'id', path, issues);
  const text = readText(value, 'text', path, issues, {
    max: LIMITS.topicLength,
    blank: 'not-allowed',
  });
  return id === undefined || text === undefined ? undefined : { id, text };
}
