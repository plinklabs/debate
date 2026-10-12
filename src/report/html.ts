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
import { SIDES, stepSeconds, type Format } from '../model/config';
import type { Locale } from '../model/locale';
import type { AppState } from '../model/reducer';
import {
  buildReport,
  formatHas,
  type ClockResult,
  type DebateResult,
  type FreeRoundResult,
  type MemberResult,
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
${whoSpoke(debate, c)}${times(debate, c)}${debate.steps.map((result) => stepSection(result, c))}${vote(debate, c)}</section>
`;
}

// ---------------------------------------------------------------------------
// Steps. The switches below cover every kind of step: a new kind (#8), or a
// jury step with scores (#10), needs a case in each before this compiles.
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
    case 'consultation': {
      const who = stepWho(result.step, format, t);
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
  }
}

/** What a step adds to its debate below the table of times. */
function stepSection(result: StepResult, c: Context): Markup | null {
  switch (result.type) {
    case 'free-round':
      return balance(result, c);
    case 'speech':
    case 'consultation':
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
  const speeches = formatHas(format, 'speech');
  const freeRound = formatHas(format, 'free-round');
  const counts: Count[] = [];
  if (speeches) counts.push({ label: t('report.speeches'), of: (m) => m.speeches });
  if (freeRound) counts.push({ label: t('report.freeRound'), of: (m) => m.freeRoundTurns });
  if (speeches && freeRound) counts.push({ label: t('report.turns'), of: (m) => m.turns });

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
