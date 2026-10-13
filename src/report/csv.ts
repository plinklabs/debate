// The report as a CSV file (#7), next to the HTML report: one row per
// student, with the team's values repeated on each row, so a teacher can
// filter and pivot in a spreadsheet. As in the original graffiti app
// (yvanvds/cursus-esthetica, debat-logic.ts): `;` between fields, UTF-8 with
// a BOM, CRLF line ends, times in whole seconds (a spreadsheet reads `1:30` as
// a time of day) and a decimal comma in Dutch. Excel with a Belgian or Dutch
// locale then opens it without an import dialog.
//
// The columns follow the format: a group of columns for each step, in order,
// and the prep time of each team when the format has a bank. The jury step's
// group holds the scores (#10).

import { stepName } from '../debate/stepText';
import { DICTIONARIES, translator, type Translate } from '../i18n/dictionary';
import { formatNumber } from '../i18n/format';
import { SIDES, stepSide, type Format, type Rubric, type Side, type Step } from '../model/config';
import { hasScored } from '../model/jury';
import type { Locale } from '../model/locale';
import type { AppState } from '../model/reducer';
import {
  buildReport,
  formatHas,
  type ClockResult,
  type DebateResult,
  type MemberResult,
  type Report,
  type ScoredResult,
  type StepResult,
} from '../model/report';

/** One row: a student of a debate, or a team without names. */
interface Row {
  readonly debate: DebateResult;
  readonly side: Side;
  /** `null` for a team without names: its values still get a row. */
  readonly member: MemberResult | null;
}

interface Column {
  readonly header: string;
  readonly cell: (row: Row) => string;
}

interface Context {
  readonly t: Translate;
  readonly locale: Locale;
  readonly format: Format;
  /** Every debate in the file: some columns depend on all of them. */
  readonly debates: readonly DebateResult[];
}

/** Quoted when it holds the separator, a quote or a line break. */
export function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Typed text, such as a name, kept from being read as a formula: a
 * spreadsheet runs a cell that starts with `=`, `+`, `-` or `@`.
 */
export function csvText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Every debate with results as the text of a .csv file. */
export function reportCsv(
  state: AppState,
  { locale, now }: { readonly locale: Locale; readonly now: number },
): string {
  return csvOf(buildReport(state.config, state.session, now), locale);
}

/** A report as the text of a .csv file. */
export function csvOf(report: Report, locale: Locale): string {
  const t = translator(DICTIONARIES[locale]);
  const { format } = report;
  const c: Context = { t, locale, format, debates: report.debates };
  const columns: Column[] = [
    { header: t('csv.debate'), cell: ({ debate }) => String(debate.number) },
    {
      header: t('csv.topic'),
      cell: ({ debate }) => csvText(debate.topic?.text ?? t('debates.topicGone')),
    },
    { header: t('csv.side'), cell: ({ side }) => csvText(format.sides[side]) },
    { header: t('csv.student'), cell: ({ member }) => csvText(member?.name ?? '') },
    {
      header: t('csv.team'),
      cell: ({ debate, side }) => csvText(debate.teams[side].map((m) => m.name).join(', ')),
    },
    { header: t('csv.turns'), cell: ({ member }) => (member === null ? '' : String(member.turns)) },
    ...stepNames(c).flatMap((name, index) => stepColumns(format.steps[index], index, name, c)),
    ...prepColumns(c),
    { header: t('csv.done'), cell: ({ debate }) => (debate.done ? t('csv.yes') : t('csv.no')) },
  ];

  const rows: Row[] = report.debates.flatMap((debate) =>
    SIDES.flatMap((side): Row[] => {
      const members = debate.teams[side];
      return members.length === 0
        ? [{ debate, side, member: null }]
        : members.map((member) => ({ debate, side, member }));
    }),
  );

  const lines = [
    columns.map((column) => csvText(column.header)),
    ...rows.map((row) => columns.map((column) => column.cell(row))),
  ];
  return `\uFEFF${lines.map((cells) => cells.map(csvField).join(';')).join('\r\n')}\r\n`;
}

/**
 * What the columns of each step are headed with: its name, and the side of a
 * speech or the side that asks in a cross-examination. Two steps that would
 * read the same, such as the two cross-examinations of each side in a Karl
 * Popper debate, get their number in front, as in the report: `02 …`.
 */
function stepNames({ t, format }: Context): string[] {
  const names = format.steps.map((step) => {
    const name = stepName(step, t);
    const side = stepSide(step);
    return side === null ? name : `${name} (${format.sides[side]})`;
  });
  return names.map((name, index) =>
    names.indexOf(name) === names.lastIndexOf(name)
      ? name
      : `${String(index + 1).padStart(2, '0')} ${name}`,
  );
}

/**
 * The columns of one step, headed with `name` (`stepNames`). The switch covers
 * every kind of step: a new kind needs its columns here.
 */
function stepColumns(step: Step, index: number, name: string, c: Context): Column[] {
  const { t, format } = c;
  /** This step's result in the row's debate: the report lists the format's steps in order. */
  const resultOf = (row: Row): StepResult => row.debate.steps[index];
  switch (step.type) {
    case 'speech':
      // A speech belongs to one side: the other side's rows leave it empty.
      return timingColumns(t, name, (row) => {
        const result = resultOf(row);
        return result.type === 'speech' && row.side === step.side ? result.clock : null;
      });
    case 'consultation':
      return timingColumns(t, name, (row) => {
        const result = resultOf(row);
        return result.type === 'consultation' ? result.clock : null;
      });
    case 'cross-examination': {
      // The clock is the asking side's, as a speech's is its side's; each
      // student's part is a role: asked, answered, or none.
      return [
        ...timingColumns(t, name, (row) => {
          const result = resultOf(row);
          return result.type === 'cross-examination' && row.side === step.askingSide
            ? result.clock
            : null;
        }),
        {
          header: t('csv.role', { step: name }),
          cell: (row) => {
            const result = resultOf(row);
            const { member, side } = row;
            if (result.type !== 'cross-examination' || member === null) return '';
            const asking = side === step.askingSide;
            const took = (asking ? result.askers : result.answerers).some(
              (other) => other.slot === member.slot,
            );
            if (!took) return '';
            return asking ? t('csv.role.asked') : t('csv.role.answered');
          },
        },
      ];
    }
    case 'audience-questions': {
      // One clock for everyone; the answers are the row's team's.
      return [
        ...timingColumns(t, name, (row) => {
          const result = resultOf(row);
          return result.type === 'audience-questions' ? result.clock : null;
        }),
        {
          header: t('csv.answers', { step: name }),
          cell: (row) => {
            const result = resultOf(row);
            return result.type === 'audience-questions' ? String(result.answers[row.side]) : '';
          },
        },
      ];
    }
    case 'free-round': {
      // A clock per team: each row has its own team's clock and turns.
      return [
        ...timingColumns(t, name, (row) => {
          const result = resultOf(row);
          return result.type === 'free-round' ? result.clocks[row.side] : null;
        }),
        {
          header: t('csv.teamTurns', { step: name }),
          cell: (row) => {
            const result = resultOf(row);
            return result.type === 'free-round' ? String(result.teamTurns[row.side]) : '';
          },
        },
      ];
    }
    case 'vote-before':
      return voteColumns(format, (side) => t('csv.votesBefore', { side }), index);
    case 'vote-after': {
      const columns = voteColumns(format, (side) => t('csv.votesAfter', { side }), index);
      // The shift needs a vote before as well.
      if (!formatHas(format, 'vote-before')) return columns;
      const pro = format.sides.pro;
      return [
        ...columns,
        {
          header: t('csv.shiftVotes', { side: pro }),
          // Like the app: no shift until each vote has a hand.
          cell: ({ debate }) => {
            const shift = debate.vote?.shift;
            return shift === undefined || shift === null || shift.pp === null
              ? ''
              : String(shift.absolute);
          },
        },
        {
          header: t('csv.shiftPoints', { side: pro }),
          cell: ({ debate }) => {
            const pp = debate.vote?.shift?.pp;
            return pp === undefined || pp === null ? '' : decimal(pp, c.locale);
          },
        },
      ];
    }
    case 'jury':
      return format.rubric === undefined ? [] : juryColumns(format.rubric, index, name, c);
  }
}

/**
 * The jury's scores of the row's team, or of the row's student when the
 * rubric scores students: each criterion and the weighted total, averaged
 * over the jurors who scored; how many did; and each juror's own total, by
 * their place on the jury, as far as the largest jury in the file goes.
 */
function juryColumns(rubric: Rubric, index: number, name: string, c: Context): Column[] {
  const { t, locale } = c;
  const scoredOf = ({ debate, side, member }: Row): ScoredResult | null => {
    const result = debate.steps[index];
    if (result.type !== 'jury') return null;
    const found = result.scored.find(
      (scored) =>
        scored.side === side && (scored.member === null || scored.member.slot === member?.slot),
    );
    return found ?? null;
  };
  const value = (score: number | null | undefined) =>
    score === null || score === undefined ? '' : average(score, locale);
  const largest = Math.max(
    0,
    ...c.debates.flatMap((debate) => {
      const result = debate.steps[index];
      return result.type === 'jury' ? result.jurors.map((juror) => juror.number) : [];
    }),
  );
  return [
    ...rubric.criteria.map((criterion, at): Column => ({
      header: t('csv.score', { step: name, criterion: criterion.label }),
      cell: (row) => value(scoredOf(row)?.average.scores[at]),
    })),
    { header: t('csv.total', { step: name }), cell: (row) => value(scoredOf(row)?.average.total) },
    {
      header: t('csv.jurors', { step: name }),
      cell: (row) => {
        const scored = scoredOf(row);
        return scored === null ? '' : String(scored.sheets.filter(hasScored).length);
      },
    },
    ...Array.from({ length: largest }, (_, at): Column => ({
      header: t('csv.jurorTotal', { step: name, number: at + 1 }),
      cell: (row) => {
        const result = row.debate.steps[index];
        if (result.type !== 'jury') return '';
        const juror = result.jurors.findIndex((candidate) => candidate.number === at + 1);
        return juror < 0 ? '' : value(scoredOf(row)?.sheets[juror]?.total);
      },
    })),
  ];
}

/**
 * Each row's team's prep time: its bank, what it used, what was left and its
 * overtime, in whole seconds. None for a format without a bank.
 */
function prepColumns({ t, format }: Context): Column[] {
  if (format.prepTime === undefined) return [];
  return timingColumns(t, t('csv.prep'), ({ debate, side }) => debate.prep?.clocks[side] ?? null);
}

/** Planned, used, left and over, in whole seconds. A clock that never ran has only its plan. */
function timingColumns(
  t: Translate,
  name: string,
  clockOf: (row: Row) => ClockResult | null,
): Column[] {
  const column = (
    key: 'csv.planned' | 'csv.used' | 'csv.left' | 'csv.overtime',
    pick: (clock: ClockResult) => number | null,
  ): Column => ({
    header: t(key, { step: name }),
    cell: (row) => {
      const clock = clockOf(row);
      const value = clock === null ? null : pick(clock);
      return value === null ? '' : String(value);
    },
  });
  return [
    column('csv.planned', (clock) => clock.planned),
    column('csv.used', (clock) => clock.timing?.used ?? null),
    column('csv.left', (clock) => clock.timing?.rest ?? null),
    column('csv.overtime', (clock) => clock.timing?.overtime ?? null),
  ];
}

/** The hands for and against in the vote of the step at `index`. */
function voteColumns(format: Format, header: (side: string) => string, index: number): Column[] {
  return SIDES.map((side) => ({
    header: header(format.sides[side]),
    cell: ({ debate }) => {
      const result = debate.steps[index];
      return (result.type === 'vote-before' || result.type === 'vote-after') && result.counted
        ? String(result.votes[side])
        : '';
    },
  }));
}

/** A score or an average: up to two decimals, with the language's decimal sign and no grouping. */
function average(value: number, locale: Locale): string {
  return formatNumber(locale, value, { maximumFractionDigits: 2, useGrouping: false });
}

/** One decimal, with the language's decimal sign and no grouping; never `-0.0`. */
function decimal(value: number, locale: Locale): string {
  const rounded = Math.round(value * 10) / 10;
  return formatNumber(locale, rounded === 0 ? 0 : rounded, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: false,
  });
}
