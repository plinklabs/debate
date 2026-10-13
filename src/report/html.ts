// The report as one self-contained HTML file (#7): every debate with
// results, in the UI language, laid out from the report model
// (src/model/report.ts). It needs nothing from outside: the style sheet is
// inline, there are no images, links or fonts to load, and its one script
// element holds data and does not run. That element is the save file: the
// whole app state, which the app reads back (src/model/reportFile.ts).
//
// Every text goes into the page through the `markup` template, which escapes
// it: names, topics and labels are typed by people.

import { stepName, stepWho } from '../debate/stepText';
import { DICTIONARIES, translator, type Translate } from '../i18n/dictionary';
import { formatDate, formatNumber } from '../i18n/format';
import { SIDES, otherSide, rubricMaxTotal, stepSeconds, type Format } from '../model/config';
import type { Sheet } from '../model/jury';
import type { Locale } from '../model/locale';
import type { AppState } from '../model/reducer';
import {
  buildReport,
  formatHas,
  type AudienceQuestionsResult,
  type ClockResult,
  type DebateResult,
  type FreeRoundResult,
  type JurorResult,
  type JuryResult,
  type MemberResult,
  type PrepResult,
  type ScoredResult,
  type StepResult,
  type VoteResult,
} from '../model/report';
import { savedStateScript } from '../model/reportFile';
import { formatClock } from '../model/timer';
import documentCss from './document.css?raw';
import { markup, trusted, type Markup } from './markup';

export interface ReportOptions {
  readonly locale: Locale;
  /** The day the report is made, in its title. */
  readonly date: Date;
  /** Now on the clock of the timers (`performance.now()`): a clock that still runs counts to here. */
  readonly now: number;
}

/** The style sheet without its comments: the report stays small. */
const STYLE = documentCss.replace(/\/\*[\s\S]*?\*\/\s*/g, '');

interface Context {
  readonly t: Translate;
  readonly locale: Locale;
  readonly format: Format;
}

/** The report of every debate with results, as the text of an .html file. */
export function reportHtml(state: AppState, { locale, date, now }: ReportOptions): string {
  const t = translator(DICTIONARIES[locale]);
  const report = buildReport(state.config, state.session, now);
  const c: Context = { t, locale, format: report.format };
  const day = formatDate(locale, date);
  const debates =
    report.debates.length === 0
      ? markup`<p class="empty">${t('report.none')}</p>\n`
      : report.debates.map((debate) => debateSection(debate, c));
  return markup`<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t('report.title')} — ${day}</title>
<style>
${trusted(STYLE)}</style>
</head>
<body>
<main>
<header>
<p class="eyebrow">// ${t('app.title')}</p>
<h1>${t('report.title')}<span class="ping" aria-hidden="true"></span></h1>
<p class="meta">${day} · ${t('report.summary', { count: report.debates.length })}</p>
<p class="note">${t('report.saveNote')}</p>
</header>
${debates}</main>
${trusted(savedStateScript(state, now))}
</body>
</html>
`.html;
}

function debateSection(debate: DebateResult, c: Context): Markup {
  const { t } = c;
  const heading = `debate-${debate.id}`;
  const status = debate.done ? t('debates.status.done') : t('report.notFinished');
  const topic = debate.topic?.text ?? t('debates.topicGone');
  return markup`<section class="debate" aria-labelledby="${heading}">
<div class="debate-head">
<h2 id="${heading}">${t('debates.label', { number: debate.number })}</h2>
<p class="${debate.done ? 'chip' : 'chip open'}">${status}</p>
</div>
<p class="${debate.topic === null ? 'topic gone' : 'topic'}">${topic}</p>
${whoSpoke(debate, c)}${times(debate, c)}${prep(debate.prep, c)}${debate.steps.map((result) => stepSection(result, c))}${vote(debate, c)}</section>
`;
}

// ---------------------------------------------------------------------------
// Steps. The switches below cover every kind of step: a new kind needs a case
// in each before this compiles.
// ---------------------------------------------------------------------------

/** The rows of a step in the table of times: one per clock, none for a step without one. */
function timeRows(result: StepResult, number: number, c: Context): Markup | null {
  const { t, format } = c;
  switch (result.type) {
    case 'speech': {
      // Who spoke in this turn, after the side.
      const side = format.sides[result.step.side];
      const names = result.speakers.map((speaker) => speaker.name);
      const who = names.length === 0 ? side : `${side} · ${names.join(', ')}`;
      return timeRow(number, stepName(result.step, t), who, result.clock, c);
    }
    case 'consultation':
    case 'audience-questions': {
      const who = stepWho(result.step, format, t);
      return timeRow(number, stepName(result.step, t), who, result.clock, c);
    }
    case 'cross-examination': {
      // Which side asks which, then who asked → who answered.
      const { askingSide } = result.step;
      const sides = t('report.crossExam.who', {
        asking: format.sides[askingSide],
        answering: format.sides[otherSide(askingSide)],
      });
      const names = (members: readonly { readonly name: string }[]) =>
        members.length === 0 ? '—' : members.map((member) => member.name).join(', ');
      const who =
        result.askers.length === 0 && result.answerers.length === 0
          ? sides
          : `${sides} · ${names(result.askers)} → ${names(result.answerers)}`;
      return timeRow(number, stepName(result.step, t), who, result.clock, c);
    }
    case 'free-round': {
      const name = stepName(result.step, t);
      return markup`${SIDES.map((side) =>
        timeRow(number, name, format.sides[side], result.clocks[side], c),
      )}`;
    }
    case 'vote-before':
    case 'vote-after':
      // No clock: the votes have a section of their own (`vote`).
      return null;
    case 'jury':
      // No clock: the scores have a section of their own (`stepSection`).
      return null;
  }
}

/** What a step adds to its debate below the table of times. */
function stepSection(result: StepResult, c: Context): Markup | null {
  switch (result.type) {
    case 'free-round':
      return balance(result, c);
    case 'audience-questions':
      return answers(result, c);
    case 'jury':
      return jury(result, c);
    case 'speech':
    case 'consultation':
    case 'cross-examination':
      return null;
    case 'vote-before':
    case 'vote-after':
      // The two votes and their shift read together: `vote`, once per debate.
      return null;
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

interface Count {
  readonly label: string;
  readonly of: (member: MemberResult) => number;
}

/** Each team with its students, and how often each one spoke. */
function whoSpoke(debate: DebateResult, c: Context): Markup {
  const { t, format, locale } = c;
  const counts: Count[] = [];
  if (formatHas(format, 'speech')) {
    counts.push({ label: t('report.speeches'), of: (m) => m.speeches });
  }
  if (formatHas(format, 'cross-examination')) {
    counts.push({ label: t('report.crossExaminations'), of: (m) => m.crossExaminations });
  }
  if (formatHas(format, 'free-round')) {
    counts.push({ label: t('report.freeRound'), of: (m) => m.freeRoundTurns });
  }
  // The sum, where there is more than one kind of turn to add up.
  if (counts.length > 1) counts.push({ label: t('report.turns'), of: (m) => m.turns });

  const heads = counts.map((count) => markup`<th scope="col" class="num">${count.label}</th>`);
  const rows = (members: readonly MemberResult[]) =>
    members.length === 0
      ? markup`<tr><td class="quiet" colspan="${counts.length + 1}">${t('report.noNames')}</td></tr>\n`
      : members.map((member) => {
          const cells = counts.map(
            (count) => markup`<td class="num">${formatNumber(locale, count.of(member))}</td>`,
          );
          return markup`<tr><th scope="row">${member.name}</th>${cells}</tr>\n`;
        });
  const tables = SIDES.map(
    (side) => markup`<table>
<caption>${format.sides[side]}</caption>
<thead><tr><th scope="col">${t('report.student')}</th>${heads}</tr></thead>
<tbody>
${rows(debate.teams[side])}</tbody>
</table>
`,
  );
  return markup`<h3>${t('report.whoSpoke')}</h3>
<div class="teams">
${tables}</div>
`;
}

/** Planned against used time for every clock of every timed step. */
function times(debate: DebateResult, c: Context): Markup | null {
  const { t, format } = c;
  if (!format.steps.some((step) => stepSeconds(step) !== null)) return null;
  const rows = debate.steps.map((result, index) => timeRows(result, index + 1, c));
  return markup`<h3>${t('report.time')}</h3>
<table class="times">
<thead><tr><th scope="col">${t('report.step')}</th><th scope="col" class="num">${t('report.planned')}</th><th scope="col" class="num">${t('report.used')}</th><th scope="col">${t('report.difference')}</th></tr></thead>
<tbody>
${rows}</tbody>
</table>
`;
}

function timeRow(
  number: number,
  name: string,
  who: string,
  clock: ClockResult,
  c: Context,
): Markup {
  const { timing } = clock;
  const no = String(number).padStart(2, '0');
  const used = timing === null ? '—' : formatClock(timing.used);
  return markup`<tr><th scope="row"><span class="no">${no}</span> ${name} <span class="who">${who}</span></th><td class="num">${formatClock(clock.planned)}</td><td class="num">${used}</td><td>${difference(clock, c)}</td></tr>
`;
}

/** Over time, stopped early, on time, or not used: in words, not only in a colour. */
function difference({ timing }: ClockResult, { t }: Context): Markup {
  if (timing === null) return markup`<span class="mark quiet">${t('report.notUsed')}</span>`;
  if (timing.overtime > 0) {
    const text = t('report.overtime', { time: formatClock(timing.overtime) });
    return markup`<span class="mark over">${text}</span>`;
  }
  if (timing.rest > 0) {
    const text = t('report.early', { time: formatClock(timing.rest) });
    return markup`<span class="mark early">${text}</span>`;
  }
  return markup`<span class="mark">${t('report.onTime')}</span>`;
}

/** The balance of a free round: each team's time, its part of the whole, its turns. */
function balance(result: FreeRoundResult, c: Context): Markup {
  const { t, format, locale } = c;
  const { share } = result;
  const percent = (value: number) =>
    formatNumber(locale, value, { style: 'percent', maximumFractionDigits: 0 });
  const rows = SIDES.map((side) => {
    const used = formatClock(result.clocks[side].timing?.used ?? 0);
    const part = share === null ? '—' : percent(share[side]);
    const turns = formatNumber(locale, result.teamTurns[side]);
    return markup`<tr><th scope="row">${format.sides[side]}</th><td class="num">${used}</td><td class="num">${part}</td><td class="num">${turns}</td></tr>\n`;
  });
  const bar =
    share === null
      ? null
      : markup`<div class="bar" aria-hidden="true"><span style="width: ${(share.pro * 100).toFixed(1)}%"></span></div>\n`;
  return markup`<h3>${t('report.balance', { step: stepName(result.step, t) })}</h3>
<table class="balance">
<thead><tr><th scope="col">${t('report.side')}</th><th scope="col" class="num">${t('report.timeUsed')}</th><th scope="col" class="num">${t('report.share')}</th><th scope="col" class="num">${t('report.teamTurns')}</th></tr></thead>
<tbody>
${rows}</tbody>
</table>
${bar}`;
}

/** How many answers each team gave to the audience, as counted. */
function answers(result: AudienceQuestionsResult, c: Context): Markup {
  const { t, format, locale } = c;
  const rows = SIDES.map(
    (side) =>
      markup`<tr><th scope="row">${format.sides[side]}</th><td class="num">${formatNumber(locale, result.answers[side])}</td></tr>\n`,
  );
  return markup`<h3>${t('report.answers', { step: stepName(result.step, t) })}</h3>
<table class="answers">
<thead><tr><th scope="col">${t('report.side')}</th><th scope="col" class="num">${t('report.answerCount')}</th></tr></thead>
<tbody>
${rows}</tbody>
</table>
`;
}

/**
 * The jury's scores (#10): per team or student, the score on each criterion
 * and the weighted total. With several jurors, the average first, then each
 * juror's own sheet.
 */
function jury(result: JuryResult, c: Context): Markup {
  const { t } = c;
  const { rubric, jurors } = result;
  const heading = markup`<h3>${t('report.jury')}</h3>
`;
  if (rubric === null)
    return markup`${heading}<p class="quiet">${t('jury.noRubric')}</p>
`;
  const scale = t('report.jury.scale', {
    min: rubric.scale.min,
    max: rubric.scale.max,
    total: rubricMaxTotal(rubric),
  });
  const intro = markup`${heading}<p class="bank">${scale}</p>
`;
  if (jurors.length === 0) {
    return markup`${intro}<p class="quiet">${t('report.jury.none')}</p>
`;
  }
  if (jurors.length === 1) {
    return markup`${intro}${scoreTable(result, jurorName(jurors[0], c), (scored) => scored.sheets[0], c)}`;
  }
  const average = t('report.jury.average', { count: jurors.length });
  return markup`${intro}${scoreTable(result, average, (scored) => scored.average, c)}${jurors.map(
    (juror, index) => scoreTable(result, jurorName(juror, c), (scored) => scored.sheets[index], c),
  )}`;
}

function jurorName(juror: JurorResult, { t }: Context): string {
  return juror.name === '' ? t('jury.juror', { number: juror.number }) : juror.name;
}

/**
 * A row per team or student, a column per criterion and the total. In a box
 * of its own that scrolls sideways on a narrow screen: ten criteria do not
 * fit on a phone.
 */
function scoreTable(
  result: JuryResult,
  caption: string,
  sheetOf: (scored: ScoredResult) => Sheet,
  c: Context,
): Markup | null {
  const { t, format } = c;
  const { rubric } = result;
  if (rubric === null) return null;
  const score = (value: number | null) => (value === null ? '—' : decimal(value, c));
  const heads = rubric.criteria.map((criterion) => {
    const weight =
      criterion.weight === 1
        ? null
        : markup` <span class="who">${t('jury.weight', { weight: criterion.weight })}</span>`;
    return markup`<th scope="col" class="num">${criterion.label}${weight}</th>`;
  });
  const rows = result.scored.map((scored) => {
    const sheet = sheetOf(scored);
    const side = format.sides[scored.side];
    const who =
      scored.member === null
        ? markup`${side}`
        : markup`${scored.member.name} <span class="who">${side}</span>`;
    const cells = sheet.scores.map((value) => markup`<td class="num">${score(value)}</td>`);
    return markup`<tr><th scope="row">${who}</th>${cells}<td class="num total">${score(sheet.total)}</td></tr>
`;
  });
  const first = rubric.scope === 'team' ? t('report.side') : t('report.student');
  return markup`<div class="wide">
<table class="jury">
<caption>${caption}</caption>
<thead><tr><th scope="col">${first}</th>${heads}<th scope="col" class="num">${t('jury.total')}</th></tr></thead>
<tbody>
${rows}</tbody>
</table>
</div>
`;
}

/** A score or an average: up to two decimals, in the language's way. */
function decimal(value: number, { locale }: Context): string {
  return formatNumber(locale, value, { maximumFractionDigits: 2 });
}

/** Each team's prep time: what it used of its bank, what was left, and any overtime. */
function prep(result: PrepResult | null, c: Context): Markup | null {
  if (result === null) return null;
  const { t, format } = c;
  const rows = SIDES.map((side) => {
    const { timing } = result.clocks[side];
    const over =
      timing.overtime > 0
        ? markup` <span class="mark over">${t('report.overtime', { time: formatClock(timing.overtime) })}</span>`
        : null;
    return markup`<tr><th scope="row">${format.sides[side]}</th><td class="num">${formatClock(timing.used)}</td><td class="num">${formatClock(timing.rest)}${over}</td></tr>\n`;
  });
  return markup`<h3>${t('report.prep')}</h3>
<p class="bank">${t('report.prep.bank', { time: formatClock(result.secondsPerTeam) })}</p>
<table class="prep">
<thead><tr><th scope="col">${t('report.side')}</th><th scope="col" class="num">${t('report.used')}</th><th scope="col" class="num">${t('report.left')}</th></tr></thead>
<tbody>
${rows}</tbody>
</table>
`;
}

/** The vote before and after: each side's hands, the share for the topic, and the shift. */
function vote(debate: DebateResult, c: Context): Markup | null {
  if (debate.vote === null) return null;
  const { t, format, locale } = c;
  const { before, after, shift } = debate.vote;
  const n = (value: number) => formatNumber(locale, value);
  const row = (label: string, result: Pick<VoteResult, 'votes' | 'counted'> | null) => {
    if (result === null) return null;
    if (!result.counted) {
      return markup`<tr><th scope="row">${label}</th><td class="quiet" colspan="3">${t('report.notCounted')}</td></tr>\n`;
    }
    const { pro, con } = result.votes;
    const share =
      pro + con === 0
        ? '—'
        : formatNumber(locale, pro / (pro + con), { style: 'percent', maximumFractionDigits: 0 });
    return markup`<tr><th scope="row">${label}</th><td class="num">${n(pro)}</td><td class="num">${n(con)}</td><td class="num">${share}</td></tr>\n`;
  };
  const sentence =
    shift === null
      ? null
      : shift.pp === null
        ? markup`<p class="shift">${t('debate.shift.none')}</p>\n`
        : markup`<p class="shift">${t('debate.shift', { points: shift.pp, side: format.sides.pro })} <span class="votes">(${t('debate.shift.votes', { count: shift.absolute })})</span></p>\n`;
  return markup`<h3>${t('report.vote')}</h3>
<table class="vote">
<thead><tr><td></td><th scope="col" class="num">${format.sides.pro}</th><th scope="col" class="num">${format.sides.con}</th><th scope="col" class="num">${t('report.shareFor', { side: format.sides.pro })}</th></tr></thead>
<tbody>
${row(t('debate.vote.before'), before)}${row(t('debate.vote.after'), after)}</tbody>
</table>
${sentence}`;
}
