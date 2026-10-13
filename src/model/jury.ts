// The jury of a debate (#10): jurors who score the teams, or each student,
// on the format's rubric, one after another on the same device. The scores
// are session data (`Debate.jury`); the rubric is the format's
// (`Format.rubric`). This module reads a jury (each juror's sheet, the
// weighted totals, the average over the jurors) and changes one, without a
// clock: scoring takes no time of its own.
//
// A score is a whole number on the rubric's scale. One that is no longer on
// it, because the scale changed after it was given, counts as not given; it
// stays stored, so it comes back with the scale.

import { LIMITS, SIDES, type Rubric, type RubricCriterion, type Side } from './config';
import {
  MAX_NAME_LENGTH,
  NO_JURY,
  membersOf,
  type Debate,
  type Juror,
  type JuryRecord,
  type Teams,
} from './session';

/** Most jurors a debate can have. */
export const MAX_JURORS = 10;

/** The id of the juror an untouched jury opens on. */
export const FIRST_JUROR_ID = 'j1';

/** Who a score is for: a team (`slot` is `null`), or a student by slot on their side. */
export interface ScoreTarget {
  readonly side: Side;
  readonly slot: number | null;
}

/** The key of a target's scores in a juror's sheet: `pro`, or `pro-0` for a student. */
export function targetKey({ side, slot }: ScoreTarget): string {
  return slot === null ? side : `${side}-${slot}`;
}

/** Whether `key` is one that `targetKey` makes: what storage may read back. */
export function isTargetKey(key: string): boolean {
  const found = /^(pro|con)(?:-(\d))?$/.exec(key);
  return found !== null && (found[2] === undefined || Number(found[2]) < LIMITS.teamSize.max);
}

/** The jury with a sheet open: a juror to score as, always. */
export interface OpenJury {
  readonly jurors: readonly Juror[];
  readonly current: string;
}

function emptyJuror(id: string): Juror {
  return { id, name: '', scores: {} };
}

/**
 * The debate's jury, open on a juror: an untouched jury opens on a first,
 * empty juror, so a sheet can be filled in at once; a first score keeps them.
 */
export function juryOf(debate: Debate): OpenJury {
  const { jurors, current } = debate.jury;
  if (jurors.length === 0) {
    return { jurors: [emptyJuror(FIRST_JUROR_ID)], current: FIRST_JUROR_ID };
  }
  const open = jurors.find((juror) => juror.id === current) ?? jurors[0];
  return { jurors, current: open.id };
}

/** Who the rubric scores in this debate: both teams, or every student with a name. */
export function scoreTargets(rubric: Rubric, teams: Teams): ScoreTarget[] {
  return SIDES.flatMap((side): ScoreTarget[] =>
    rubric.scope === 'team'
      ? [{ side, slot: null }]
      : membersOf(teams, side).map((member) => ({ side, slot: member.slot })),
  );
}

function isTarget(rubric: Rubric, teams: Teams, target: ScoreTarget): boolean {
  return scoreTargets(rubric, teams).some(
    (candidate) => candidate.side === target.side && candidate.slot === target.slot,
  );
}

/** Whether `value` is a score on this rubric's scale. */
export function isScore(rubric: Rubric, value: number): boolean {
  return Number.isInteger(value) && value >= rubric.scale.min && value <= rubric.scale.max;
}

/** A juror's score for a target on a criterion; `null` when not given, or off the scale. */
export function scoreOf(
  rubric: Rubric,
  juror: Juror,
  target: ScoreTarget,
  criterionId: string,
): number | null {
  const key = targetKey(target);
  const scores = Object.hasOwn(juror.scores, key) ? juror.scores[key] : undefined;
  const value =
    scores !== undefined && Object.hasOwn(scores, criterionId) ? scores[criterionId] : undefined;
  return value !== undefined && isScore(rubric, value) ? value : null;
}

/** Scores per criterion, in the rubric's order, and their weighted total. */
export interface Sheet {
  /** A score per criterion of the rubric, in order; `null` where none was given. */
  readonly scores: readonly (number | null)[];
  /** Each score times its criterion's weight, added up; `null` when nothing was scored. */
  readonly total: number | null;
}

/** What `scores` (one per criterion, in order) add up to, each weighed. */
export function weightedTotal(
  criteria: readonly RubricCriterion[],
  scores: readonly (number | null)[],
): number | null {
  let total: number | null = null;
  criteria.forEach((criterion, index) => {
    const score = scores[index];
    if (score !== null && score !== undefined) total = (total ?? 0) + score * criterion.weight;
  });
  return total;
}

/** One juror's sheet for one target. */
export function sheetOf(rubric: Rubric, juror: Juror, target: ScoreTarget): Sheet {
  const scores = rubric.criteria.map((criterion) => scoreOf(rubric, juror, target, criterion.id));
  return { scores, total: weightedTotal(rubric.criteria, scores) };
}

function mean(values: readonly (number | null)[]): number | null {
  const given = values.filter((value): value is number => value !== null);
  return given.length === 0 ? null : given.reduce((sum, value) => sum + value, 0) / given.length;
}

/**
 * Several jurors' sheets for one target averaged: each criterion over the
 * jurors who scored it, and the total over the jurors' totals. Where nobody
 * scored, `null`.
 */
export function averageSheet(rubric: Rubric, sheets: readonly Sheet[]): Sheet {
  return {
    scores: rubric.criteria.map((_, index) =>
      mean(sheets.map((sheet) => sheet.scores[index] ?? null)),
    ),
    total: mean(sheets.map((sheet) => sheet.total)),
  };
}

/** Whether a juror gave this target any score. */
export function hasScored(sheet: Sheet): boolean {
  return sheet.total !== null;
}

// ---------------------------------------------------------------------------
// Changes. Each returns the debate itself when nothing changes.
// ---------------------------------------------------------------------------

function withJury(debate: Debate, jury: JuryRecord): Debate {
  return { ...debate, jury };
}

function updateJuror(debate: Debate, jurorId: string, update: (juror: Juror) => Juror): Debate {
  const jury = juryOf(debate);
  const juror = jury.jurors.find((candidate) => candidate.id === jurorId);
  if (juror === undefined) return debate;
  const next = update(juror);
  if (next === juror) return debate;
  return withJury(debate, {
    jurors: jury.jurors.map((candidate) => (candidate.id === jurorId ? next : candidate)),
    current: jury.current,
  });
}

/**
 * A juror's score for a target on a criterion, or no score for `null`. A
 * score off the scale, a criterion the rubric does not have, or a target it
 * does not score (a team when it scores students, a slot without a name)
 * changes nothing.
 */
export function setScore(
  rubric: Rubric,
  debate: Debate,
  jurorId: string,
  target: ScoreTarget,
  criterionId: string,
  score: number | null,
): Debate {
  if (score !== null && !isScore(rubric, score)) return debate;
  if (!rubric.criteria.some((criterion) => criterion.id === criterionId)) return debate;
  if (!isTarget(rubric, debate.teams, target)) return debate;
  const key = targetKey(target);
  return updateJuror(debate, jurorId, (juror) => {
    const scores = Object.hasOwn(juror.scores, key) ? juror.scores[key] : {};
    const had = Object.hasOwn(scores, criterionId) ? scores[criterionId] : null;
    if (had === score) return juror;
    const { [criterionId]: _, ...rest } = scores;
    const next = score === null ? rest : { ...rest, [criterionId]: score };
    const { [key]: __, ...others } = juror.scores;
    return {
      ...juror,
      scores: Object.keys(next).length === 0 ? others : { ...others, [key]: next },
    };
  });
}

/** Another juror, after the others, whose sheet opens. */
export function addJuror(debate: Debate): Debate {
  const { jurors } = juryOf(debate);
  if (jurors.length >= MAX_JURORS) return debate;
  const taken = new Set(jurors.map((juror) => juror.id));
  let n = 1;
  while (taken.has(`j${n}`)) n += 1;
  const juror = emptyJuror(`j${n}`);
  return withJury(debate, { jurors: [...jurors, juror], current: juror.id });
}

/**
 * A juror taken off the jury, with their scores. The sheet of the next juror
 * opens, or of the one before when it was the last; without jurors, the jury
 * is untouched again.
 */
export function removeJuror(debate: Debate, jurorId: string): Debate {
  const jury = juryOf(debate);
  const index = jury.jurors.findIndex((juror) => juror.id === jurorId);
  if (index < 0) return debate;
  const jurors = jury.jurors.filter((juror) => juror.id !== jurorId);
  if (jurors.length === 0) return debate.jury === NO_JURY ? debate : withJury(debate, NO_JURY);
  const current =
    jury.current === jurorId ? jurors[Math.min(index, jurors.length - 1)].id : jury.current;
  return withJury(debate, { jurors, current });
}

/** Open a juror's sheet. */
export function selectJuror(debate: Debate, jurorId: string): Debate {
  const jury = juryOf(debate);
  if (jury.current === jurorId || !jury.jurors.some((juror) => juror.id === jurorId)) {
    return debate;
  }
  return withJury(debate, { jurors: jury.jurors, current: jurorId });
}

/** A juror's name, as typed, cut to the length of a student's name. */
export function setJurorName(debate: Debate, jurorId: string, name: string): Debate {
  const cut = name.slice(0, MAX_NAME_LENGTH);
  return updateJuror(debate, jurorId, (juror) =>
    juror.name === cut ? juror : { ...juror, name: cut },
  );
}

/** Every juror and score gone: the jury as it was before anyone scored. */
export function clearJury(debate: Debate): Debate {
  return debate.jury === NO_JURY ? debate : withJury(debate, NO_JURY);
}
