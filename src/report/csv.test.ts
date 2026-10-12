// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { DebateConfig } from '../model/config';
import { GRAFFITI_PRESET } from '../model/presets';
import type { AppState } from '../model/reducer';
import { playedSession } from '../test/playedSession';
import { csvField, csvText, reportCsv } from './csv';

function csv(state: AppState = playedSession(), locale: 'en' | 'nl' = 'en') {
  return reportCsv(state, { locale, now: 0 });
}

/** The cells of each line, for a CSV without quoted fields. */
function table(text: string): string[][] {
  return text
    .replace(/^﻿/, '')
    .replace(/\r\n$/, '')
    .split('\r\n')
    .map((line) => line.split(';'));
}

/** Each row as an object by header, for the columns that matter to a test. */
function records(text: string): Record<string, string>[] {
  const [header, ...rows] = table(text);
  return rows.map((row) => Object.fromEntries(header.map((name, i) => [name, row[i]])));
}

describe('csvField', () => {
  it('quotes a field with the separator, a quote or a line break', () => {
    expect(csvField('Ann')).toBe('Ann');
    expect(csvField('Ann; Bert')).toBe('"Ann; Bert"');
    expect(csvField('Say "no"')).toBe('"Say ""no"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
  });
});

describe('csvText', () => {
  it('keeps typed text from being read as a formula', () => {
    expect(csvText('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
    expect(csvText('+32 474')).toBe("'+32 474");
    expect(csvText('-Ann')).toBe("'-Ann");
    expect(csvText('@Ann')).toBe("'@Ann");
    expect(csvText('Ann = Bert')).toBe('Ann = Bert');
  });
});

describe('the CSV', () => {
  it('is UTF-8 with a BOM, separated by ;, with CRLF line ends', () => {
    const text = csv();
    expect(text.startsWith('﻿Debate;Topic;Side;Student;Team members;Turns;')).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toContain('\n');
    const [header, ...rows] = table(text);
    for (const row of rows) expect(row).toHaveLength(header.length);
  });

  it('has a group of columns for each step of the format, in order', () => {
    const [header] = table(csv());
    expect(header).toEqual([
      'Debate',
      'Topic',
      'Side',
      'Student',
      'Team members',
      'Turns',
      'Votes FOR before',
      'Votes AGAINST before',
      'Opening (FOR) planned (s)',
      'Opening (FOR) used (s)',
      'Opening (FOR) left (s)',
      'Opening (FOR) overtime (s)',
      'Opening (AGAINST) planned (s)',
      'Opening (AGAINST) used (s)',
      'Opening (AGAINST) left (s)',
      'Opening (AGAINST) overtime (s)',
      'Short consultation planned (s)',
      'Short consultation used (s)',
      'Short consultation left (s)',
      'Short consultation overtime (s)',
      'Rebuttal (FOR) planned (s)',
      'Rebuttal (FOR) used (s)',
      'Rebuttal (FOR) left (s)',
      'Rebuttal (FOR) overtime (s)',
      'Rebuttal (AGAINST) planned (s)',
      'Rebuttal (AGAINST) used (s)',
      'Rebuttal (AGAINST) left (s)',
      'Rebuttal (AGAINST) overtime (s)',
      'Free round planned (s)',
      'Free round used (s)',
      'Free round left (s)',
      'Free round overtime (s)',
      'Free round team turns',
      'Closing statement (AGAINST) planned (s)',
      'Closing statement (AGAINST) used (s)',
      'Closing statement (AGAINST) left (s)',
      'Closing statement (AGAINST) overtime (s)',
      'Closing statement (FOR) planned (s)',
      'Closing statement (FOR) used (s)',
      'Closing statement (FOR) left (s)',
      'Closing statement (FOR) overtime (s)',
      'Votes FOR after',
      'Votes AGAINST after',
      'Shift FOR (votes)',
      'Shift FOR (pp)',
      'Finished',
    ]);
  });

  it('has a row per student of every debate with results, the team values on each', () => {
    const rows = records(csv());
    expect(rows.map((row) => [row.Debate, row.Side, row.Student, row['Team members']])).toEqual([
      ['1', 'FOR', 'Ann', 'Ann, Bert'],
      ['1', 'FOR', 'Bert', 'Ann, Bert'],
      ['1', 'AGAINST', 'Dirk', 'Dirk, Eva'],
      ['1', 'AGAINST', 'Eva', 'Dirk, Eva'],
      ['2', 'FOR', 'Fien', 'Fien, Gert'],
      ['2', 'FOR', 'Gert', 'Fien, Gert'],
      ['2', 'AGAINST', 'Hanne', 'Hanne, Ilse'],
      ['2', 'AGAINST', 'Ilse', 'Hanne, Ilse'],
    ]);
    expect(rows[0].Topic).toBe(GRAFFITI_PRESET.build('en').topics[0].text);
  });

  it('gives whole seconds: planned, used, left and over; only the plan for a clock that never ran', () => {
    const [ann, , dirk, eva] = records(csv());
    expect(
      ['planned', 'used', 'left', 'overtime'].map((part) => ann[`Opening (FOR) ${part} (s)`]),
    ).toEqual(['60', '72', '0', '12']);
    // A speech of the other side is not the student's own.
    expect(ann['Opening (AGAINST) used (s)']).toBe('');
    expect(
      ['planned', 'used', 'left', 'overtime'].map((part) => dirk[`Opening (AGAINST) ${part} (s)`]),
    ).toEqual(['60', '45', '15', '0']);
    expect(
      ['planned', 'used', 'left', 'overtime'].map((part) => eva[`Short consultation ${part} (s)`]),
    ).toEqual(['60', '', '', '']);
  });

  it("gives each row its own team's free-round clock and turns", () => {
    const [ann, , dirk] = records(csv());
    expect([ann['Free round used (s)'], ann['Free round team turns']]).toEqual(['8', '2']);
    expect([dirk['Free round used (s)'], dirk['Free round team turns']]).toEqual(['12', '1']);
  });

  it('gives how often each student spoke, the votes, the shift and whether it is finished', () => {
    const [ann, , dirk, , fien] = records(csv());
    expect([ann.Turns, dirk.Turns]).toEqual(['2', '1']);
    expect([ann['Votes FOR before'], ann['Votes AGAINST before']]).toEqual(['10', '15']);
    expect([ann['Votes FOR after'], ann['Votes AGAINST after']]).toEqual(['13', '11']);
    expect([ann['Shift FOR (votes)'], ann['Shift FOR (pp)'], ann.Finished]).toEqual([
      '3',
      '14.2',
      'yes',
    ]);
    // Debate 2 has not counted its vote after: no counts, and no shift.
    expect([fien['Votes FOR before'], fien['Votes FOR after']]).toEqual(['8', '']);
    expect([fien['Shift FOR (votes)'], fien['Shift FOR (pp)'], fien.Finished]).toEqual([
      '',
      '',
      'no',
    ]);
  });

  it('is written in Dutch, with a decimal comma', () => {
    const text = csv(playedSession(GRAFFITI_PRESET.build('nl')), 'nl');
    expect(text.startsWith('﻿Debat;Stelling;Kant;Leerling;Teamleden;Beurten;')).toBe(true);
    const [ann] = records(text);
    expect(ann['Opening (VOOR) overtijd (s)']).toBe('12');
    expect(ann['Verschuiving VOOR (pp)']).toBe('14,2');
    expect(ann.Afgerond).toBe('ja');
  });

  it('writes a negative shift with its sign, and never -0', () => {
    const state = playedSession();
    const [d1] = state.session.debates;
    const flipped = (pro: number, con: number): AppState => ({
      ...state,
      session: {
        ...state.session,
        debates: [
          {
            ...d1,
            records: { ...d1.records, 'vote-after': { type: 'vote-after', votes: { pro, con } } },
          },
        ],
      },
    });
    expect(records(csv(flipped(5, 20)))[0]['Shift FOR (pp)']).toBe('-20.0');
    // 10 of 25 before, and 20 of 50 after: the same share.
    expect(records(csv(flipped(20, 30)))[0]['Shift FOR (pp)']).toBe('0.0');
  });

  it('quotes what holds a separator, and keeps typed text from being a formula', () => {
    const base = playedSession(undefined, { ann: 'Ann; "Annie"', eva: '=1+1' });
    const text = csv(base);
    const lines = text.split('\r\n');
    expect(lines[1]).toContain(';"Ann; ""Annie""";"Ann; ""Annie"", Bert";');
    expect(lines[4]).toContain(";'=1+1;");
  });

  it('follows another format: no free round and no votes means no such columns', () => {
    const state = playedSession();
    const speeches: DebateConfig = {
      ...state.config,
      format: {
        ...state.config.format,
        steps: state.config.format.steps.filter((step) => step.type === 'speech'),
      },
    };
    const [header] = table(csv({ ...state, config: speeches }));
    expect(header.filter((name) => /Free round|Votes|Shift/.test(name))).toEqual([]);
    expect(header).toHaveLength(6 + 6 * 4 + 1);
  });

  it('keeps a team without names as one row', () => {
    const state = playedSession();
    const [d1] = state.session.debates;
    const nameless: AppState = {
      ...state,
      session: { ...state.session, debates: [{ ...d1, teams: { ...d1.teams, con: [] } }] },
    };
    const rows = records(csv(nameless));
    expect(rows.map((row) => [row.Side, row.Student, row['Free round used (s)']])).toEqual([
      ['FOR', 'Ann', '8'],
      ['FOR', 'Bert', '8'],
      ['AGAINST', '', '12'],
    ]);
  });
});
