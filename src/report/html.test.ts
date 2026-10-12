import { describe, expect, it } from 'vitest';
import type { DebateConfig } from '../model/config';
import { GRAFFITI_PRESET } from '../model/presets';
import { freeze, type AppState } from '../model/reducer';
import { readReportText } from '../model/reportFile';
import { playedSession } from '../test/playedSession';
import { reportHtml } from './html';
import { escapeHtml, markup, trusted } from './markup';

const DAY = new Date(2026, 9, 12, 9, 0);

const XSS_NAME = '<img src=x onerror=alert(1)>';
const BREAKOUT = '</script><script>alert(2)</script>';

function make(state: AppState = playedSession(), locale: 'en' | 'nl' = 'en') {
  return reportHtml(state, { locale, date: DAY, now: 0 });
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

/** The text of an element, with its white space as it reads. */
const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();

/** The rows of a table, cell by cell. */
function rows(table: Element | null | undefined): string[][] {
  return [...(table?.querySelectorAll('tr') ?? [])].map((row) =>
    [...row.children].map((cell) => text(cell) ?? ''),
  );
}

function section(doc: Document, number: number): Element {
  const found = doc.querySelectorAll('section.debate')[number - 1];
  if (found === undefined) throw new Error(`no debate ${number}`);
  return found;
}

describe('markup', () => {
  it('escapes every value put into it, and keeps markup made here', () => {
    const inner = markup`<b>${'a < b'}</b>`;
    expect(markup`<p title="${'"x" & \'y\''}">${inner}${[1, null, false, ' & ']}</p>`.html).toBe(
      '<p title="&quot;x&quot; &amp; &#39;y&#39;"><b>a &lt; b</b>1 &amp; </p>',
    );
    expect(markup`${trusted('<hr>')}`.html).toBe('<hr>');
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });
});

describe('the report', () => {
  it('is one page in the UI language, with the date in its title', () => {
    const doc = parse(make());
    expect(doc.documentElement.lang).toBe('en');
    expect(doc.title).toBe('Debate report — October 12, 2026');
    expect(text(doc.querySelector('h1'))).toBe('Debate report');
    expect(text(doc.querySelector('.meta'))).toBe('October 12, 2026 · 2 debates with results');

    const dutch = parse(make(playedSession(GRAFFITI_PRESET.build('nl')), 'nl'));
    expect(dutch.documentElement.lang).toBe('nl');
    expect(dutch.title).toBe('Debatverslag — 12 oktober 2026');
    expect(text(dutch.querySelector('.meta'))).toBe('12 oktober 2026 · 2 debatten met resultaten');
  });

  it('shows each debate with results: number, topic, and whether it is finished', () => {
    const doc = parse(make());
    expect([...doc.querySelectorAll('section.debate h2')].map(text)).toEqual([
      'Debate 1',
      'Debate 2',
    ]);
    expect(text(section(doc, 1).querySelector('.chip'))).toBe('Finished');
    expect(text(section(doc, 2).querySelector('.chip'))).toBe('Not finished');
    expect(text(section(doc, 1).querySelector('.topic'))).toBe(
      GRAFFITI_PRESET.build('en').topics[0].text,
    );
  });

  it('says who spoke and how often, per team', () => {
    const tables = section(parse(make()), 1).querySelectorAll('.teams table');
    expect(text(tables[0].querySelector('caption'))).toBe('FOR');
    expect(rows(tables[0])).toEqual([
      ['Student', 'Speeches', 'Free round', 'Turns'],
      ['Ann', '1', '1', '2'],
      ['Bert', '1', '1', '2'],
    ]);
    expect(rows(tables[1])).toEqual([
      ['Student', 'Speeches', 'Free round', 'Turns'],
      ['Dirk', '1', '0', '1'],
      ['Eva', '0', '1', '1'],
    ]);
  });

  it('lists planned against used time per clock, with overtime and early stops marked', () => {
    const times = rows(section(parse(make()), 1).querySelector('table.times'));
    expect(times.slice(0, 4)).toEqual([
      ['Step', 'Planned', 'Used', 'Difference'],
      ['02 Opening FOR · Ann, Bert', '1:00', '1:12', '+0:12 over time'],
      ['03 Opening AGAINST · Dirk', '1:00', '0:45', 'stopped 0:15 early'],
      ['04 Short consultation Both teams', '1:00', '—', 'not used'],
    ]);
    // The free round has a clock per team; the votes have none.
    expect(times.filter((row) => row[0].startsWith('07'))).toEqual([
      ['07 Free round FOR', '1:30', '0:08', 'stopped 1:22 early'],
      ['07 Free round AGAINST', '1:30', '0:12', 'stopped 1:18 early'],
    ]);
    expect(times.some((row) => row[0].startsWith('01'))).toBe(false);
  });

  it('says a clock that ran exactly its time was on time', () => {
    const state = playedSession();
    const [d1] = state.session.debates;
    const exact: AppState = {
      ...state,
      session: {
        ...state.session,
        debates: [
          {
            ...d1,
            records: {
              ...d1.records,
              'opening-pro': {
                type: 'speech',
                timer: { accMs: 60_400, since: null },
                speakers: [],
                current: null,
              },
            },
          },
        ],
      },
    };
    const times = rows(section(parse(make(exact)), 1).querySelector('table.times'));
    expect(times[1]).toEqual(['02 Opening FOR', '1:00', '1:00', 'on time']);
  });

  it('gives the balance of the free round', () => {
    const debate = section(parse(make()), 1);
    expect(text(debate.querySelector('table.balance')?.previousElementSibling ?? null)).toBe(
      'Free round: balance between the teams',
    );
    expect(rows(debate.querySelector('table.balance'))).toEqual([
      ['Side', 'Time used', 'Share', 'Team turns'],
      ['FOR', '0:08', '40%', '2'],
      ['AGAINST', '0:12', '60%', '1'],
    ]);
    expect(debate.querySelector<HTMLElement>('.bar > span')?.style.width).toBe('40%');
  });

  it('gives the vote before and after, and the shift', () => {
    const doc = parse(make());
    expect(rows(section(doc, 1).querySelector('table.vote'))).toEqual([
      ['', 'FOR', 'AGAINST', 'Share FOR'],
      ['Before', '10', '15', '40%'],
      ['After', '13', '11', '54%'],
    ]);
    expect(text(section(doc, 1).querySelector('.shift'))).toBe(
      'Shift towards FOR: +14.2 percentage points (+3 votes)',
    );
    // Debate 2 has not counted its vote after.
    expect(rows(section(doc, 2).querySelector('table.vote')).slice(1)).toEqual([
      ['Before', '8', '0', '100%'],
      ['After', 'not counted'],
    ]);
    expect(text(section(doc, 2).querySelector('.shift'))).toBe(
      'No shift yet: each vote needs at least one hand.',
    );
  });

  it('is written in Dutch, numbers included', () => {
    const doc = parse(make(playedSession(GRAFFITI_PRESET.build('nl')), 'nl'));
    const debate = section(doc, 1);
    expect(text(debate.querySelector('.chip'))).toBe('Afgewerkt');
    expect(text(section(doc, 2).querySelector('.chip'))).toBe('Niet afgewerkt');
    expect(rows(debate.querySelector('table.times'))[1]).toEqual([
      '02 Opening VOOR · Ann, Bert',
      '1:00',
      '1:12',
      '+0:12 overtijd',
    ]);
    expect(text(debate.querySelector('.shift'))).toBe(
      'Verschuiving naar VOOR: +14,2 procentpunten (+3 stemmen)',
    );
  });

  it('leaves out what the format does not have', () => {
    const state = playedSession();
    const speechesOnly: DebateConfig = {
      ...state.config,
      format: {
        ...state.config.format,
        steps: state.config.format.steps.filter((step) => step.type === 'speech'),
      },
    };
    const debate = section(parse(make({ ...state, config: speechesOnly })), 1);
    expect(debate.querySelector('table.balance')).toBeNull();
    expect(debate.querySelector('table.vote')).toBeNull();
    expect(rows(debate.querySelector('.teams table'))[0]).toEqual(['Student', 'Speeches']);
  });

  it('says so when no debate has results yet', () => {
    const state = playedSession();
    const empty = { ...state, session: { debates: [], current: null } };
    const doc = parse(make(empty));
    expect(text(doc.querySelector('.empty'))).toBe('No debate has results yet.');
    expect(doc.querySelectorAll('section.debate')).toHaveLength(0);
  });

  it('needs nothing from outside: no links, images, fonts or scripts that run', () => {
    const html = make();
    expect(html).not.toMatch(/https?:|\bsrc=|\bhref=|url\(|@import|@font-face/i);
    const doc = parse(html);
    expect(doc.querySelectorAll('link, img, iframe, object, embed, a')).toHaveLength(0);
    const scripts = [...doc.querySelectorAll('script')];
    expect(scripts.map((script) => script.type)).toEqual(['application/json']);
    // A print style sheet for A4.
    const style = text(doc.querySelector('style')) ?? '';
    expect(style).toMatch(/@page \{ size: A4;/);
    expect(style).toContain('@media print');
  });

  it('holds the session, which reads back as it was', () => {
    const state = playedSession();
    expect(readReportText(make(state))).toEqual({ ok: true, state: freeze(state, 0) });
  });

  it('shows typed text as text: no name, topic or label can add markup or end the data', () => {
    const base = playedSession(undefined, { ann: XSS_NAME, eva: BREAKOUT.slice(0, 40) });
    const config: DebateConfig = {
      ...base.config,
      format: {
        ...base.config.format,
        sides: { pro: '<b>FOR</b>', con: BREAKOUT.slice(0, 30) },
        steps: base.config.format.steps.map((step) =>
          step.id === 'opening-pro' ? { ...step, label: '<i>Opening</i>' } : step,
        ),
      },
      topics: base.config.topics.map((topic) =>
        topic.id === 't1' ? { ...topic, text: `${XSS_NAME} ${BREAKOUT}` } : topic,
      ),
    };
    const state: AppState = { ...base, config };
    const html = make(state);

    // One script element, the data, and nothing typed outside the text.
    expect(html.match(/<script/gi)).toHaveLength(1);
    expect(html.match(/<\/script/gi)).toHaveLength(1);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');

    const doc = parse(html);
    expect(doc.querySelectorAll('img, b, i')).toHaveLength(0);
    expect(doc.querySelectorAll('script')).toHaveLength(1);
    const debate = section(doc, 1);
    expect(text(debate.querySelector('.topic'))).toBe(`${XSS_NAME} ${BREAKOUT}`);
    expect(text(debate.querySelector('.teams tbody th'))).toBe(XSS_NAME);
    expect(text(debate.querySelector('.teams caption'))).toBe('<b>FOR</b>');
    expect(rows(debate.querySelector('table.times'))[1][0]).toBe(
      `02 <i>Opening</i> <b>FOR</b> · ${XSS_NAME}, Bert`,
    );
    // And the data reads back with the same names.
    expect(readReportText(html)).toEqual({ ok: true, state: freeze(state, 0) });
  });
});
