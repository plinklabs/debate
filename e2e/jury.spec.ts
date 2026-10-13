import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { expectFits } from './helpers';

// Jury scoring end to end (#10): the standard rubric switched on in the format
// editor and a jury step added at the end; a short debate on Playwright's fake
// clock up to that step; two jurors who fill in the score sheet one after the
// other, with the totals and their average on the stage; then the report and
// the CSV with the scores, and a share link that carries the rubric and none
// of the scores. Both projects run it: Desktop Chrome is the 1280×720
// projector, Pixel 7 the phone.

const STORAGE_KEY = 'plinklabs:debate:v1';

const START = new Date('2026-10-12T09:00:00');

/** A juror's name: session data, like the students' names. */
const SMITH = 'Mr. Smith';

const CRITERIA = ['Content and arguments', 'Rebuttal', 'Evidence and examples', 'Delivery'];

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const currentStep = (page: Page) =>
  page.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]');

async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

/** Time passes on the fake clock a second at a time, as it would on the wall. */
async function pass(page: Page, ms: number) {
  for (let left = ms; left > 0; left -= 1000) await page.clock.runFor(Math.min(1000, left));
}

async function goToStep(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name }).click();
  await expect(currentStep(page)).toHaveAccessibleName(name);
}

/** The JSON inside a link, unpacked by Node rather than by the app. */
function inside(link: string): string {
  return inflateRawSync(Buffer.from(link.split('#c=')[1], 'base64url')).toString('utf8');
}

/** The cells of the rows of a table, as text. */
function rows(table: Locator) {
  return table.evaluate((element) =>
    [...element.querySelectorAll('tr')].map((row) =>
      [...row.children].map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()),
    ),
  );
}

/** The open juror's sheet for a team. */
function sheet(page: Page, juror: string, side: string) {
  return page
    .getByRole('region', { name: `Score sheet of ${juror}` })
    .getByRole('group', { name: side, exact: true });
}

/** A juror scores a team on the four criteria, in their order. */
async function score(page: Page, juror: string, side: string, scores: readonly number[]) {
  const team = sheet(page, juror, side);
  for (const [index, value] of scores.entries()) {
    await team
      .getByRole('group', { name: CRITERIA[index], exact: true })
      .getByRole('radio', { name: String(value), exact: true })
      .check();
  }
}

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('scores a debate on the standard rubric with two jurors, reports the scores and shares only the rubric', async ({
    page,
    browser,
  }, testInfo) => {
    await page.clock.install({ time: START });
    await page.goto('./');
    await page.clock.pauseAt(new Date(START.getTime() + 5000));

    // ── Format: the standard rubric, and a jury step at the end ──
    await tab(page, 'Format').click();
    const rubric = page.getByRole('group', { name: 'Jury rubric' });
    await rubric.getByRole('button', { name: 'Add standard rubric' }).click();
    await expect(rubric.getByRole('spinbutton', { name: 'Lowest score' })).toHaveValue('1');
    await expect(rubric.getByRole('spinbutton', { name: 'Highest score' })).toHaveValue('4');
    await expect(
      rubric.getByRole('combobox', { name: 'Scored' }).locator('option:checked'),
    ).toHaveText('Per team');
    await expect(rubric.getByText('Highest total: 16')).toBeVisible();
    for (const [index, name] of CRITERIA.entries()) {
      const criterion = rubric.getByRole('group', { name: `Criterion ${index + 1}`, exact: true });
      await expect(criterion.getByRole('textbox', { name: 'Name' })).toHaveValue(name);
      await expect(criterion.getByRole('spinbutton', { name: 'Weight' })).toHaveValue('1');
    }
    await expect(rubric.getByText('No step scores on it yet', { exact: false })).toBeVisible();

    await button(page, 'Add step').click();
    const jury = page.getByRole('group', { name: 'Step 11', exact: true });
    await jury.getByRole('combobox', { name: 'Kind' }).selectOption('Jury');
    await expect(jury.getByText('The jury scores on the rubric. No timer.')).toBeVisible();
    // A second jury step cannot be made.
    const opening = page.getByRole('group', { name: 'Step 2', exact: true });
    await expect(
      opening.getByRole('combobox', { name: 'Kind' }).getByRole('option', { name: 'Jury' }),
    ).toBeDisabled();
    // Nor can the rubric go while the step scores on it.
    await expect(rubric.getByRole('button', { name: 'Remove rubric' })).toHaveCount(0);
    await expect(
      rubric.getByText('A “Jury” step scores on this rubric', { exact: false }),
    ).toBeVisible();
    await expectFits(page);

    // ── A short debate, up to the jury ──
    await tab(page, 'Debates and teams').click();
    await button(page, 'Add debate').click();
    const debate = page.getByRole('article', { name: 'Debate 1' });
    for (const [side, names] of [
      ['FOR', ['Ann', 'Bert']],
      ['AGAINST', ['Dirk', 'Eva']],
    ] as const) {
      const team = debate.getByRole('group', { name: side, exact: true });
      for (const [slot, name] of names.entries()) {
        await team.getByRole('textbox', { name: `Name ${slot + 1}`, exact: true }).fill(name);
      }
    }
    await debate.getByRole('button', { name: 'Start' }).click();
    await goToStep(page, 'Step 2: Opening (FOR)');
    await button(page, 'Ann').click();
    await pass(page, 30_000);
    await goToStep(page, 'Step 3: Opening (AGAINST)');
    await button(page, 'Dirk').click();
    await pass(page, 20_000);

    await goToStep(page, 'Step 11: Jury');
    await expect(page.getByText('Step 11 of 11 · The jury')).toBeVisible();
    await expect(
      page.getByText('Score each team on every criterion.', { exact: false }),
    ).toBeVisible();
    // No clock to start: the jury takes its time.
    await expect(button(page, 'Start')).toHaveCount(0);

    // ── Juror 1 ──
    const jurors = page.getByRole('group', { name: 'Jurors' });
    await expect(jurors.getByRole('button', { name: 'Juror 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(sheet(page, 'Juror 1', 'FOR')).toContainText('Total— / 16');
    await score(page, 'Juror 1', 'FOR', [3, 2, 4, 3]);
    await expect(
      sheet(page, 'Juror 1', 'FOR').getByText(
        'Clear and relevant arguments, mostly well explained.',
      ),
    ).toBeVisible();
    await expect(sheet(page, 'Juror 1', 'FOR')).toContainText('Total12 / 16');
    await score(page, 'Juror 1', 'AGAINST', [2, 3, 3, 2]);
    await expect(sheet(page, 'Juror 1', 'AGAINST')).toContainText('Total10 / 16');
    // A score taken back, and given again.
    await button(page, 'Clear the score of AGAINST for Delivery').click();
    await expect(sheet(page, 'Juror 1', 'AGAINST')).toContainText('Total8 / 16');
    await score(page, 'Juror 1', 'AGAINST', [2, 3, 3, 2]);
    await expect(sheet(page, 'Juror 1', 'AGAINST')).toContainText('Total10 / 16');
    // One juror: no totals to compare yet.
    await expect(page.getByRole('region', { name: 'Totals of all jurors' })).toHaveCount(0);
    await expectFits(page);

    // ── Juror 2, on the same device ──
    await jurors.getByRole('button', { name: 'Add juror' }).click();
    await expect(jurors.getByRole('button', { name: 'Juror 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(sheet(page, 'Juror 2', 'FOR')).toContainText('Total— / 16');
    await page.getByRole('textbox', { name: 'Name of this juror (optional)' }).fill(SMITH);
    await expect(jurors.getByRole('button', { name: SMITH })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await score(page, SMITH, 'FOR', [4, 3, 3, 4]);
    await score(page, SMITH, 'AGAINST', [3, 3, 2, 3]);
    await expect(sheet(page, SMITH, 'FOR')).toContainText('Total14 / 16');
    await expect(sheet(page, SMITH, 'AGAINST')).toContainText('Total11 / 16');

    // Each juror's total and the average, on the stage.
    const totals = page.getByRole('region', { name: 'Totals of all jurors' });
    expect(await rows(totals.getByRole('table'))).toEqual([
      ['Side', 'Juror 1', SMITH, 'Average'],
      ['FOR', '12', '14', '13'],
      ['AGAINST', '10', '11', '10.5'],
    ]);
    await expectFits(page);

    // Back to juror 1: their sheet as they left it.
    await jurors.getByRole('button', { name: 'Juror 1' }).click();
    await expect(
      sheet(page, 'Juror 1', 'FOR')
        .getByRole('group', { name: 'Content and arguments' })
        .getByRole('radio', { name: '3', exact: true }),
    ).toBeChecked();
    await expect(sheet(page, 'Juror 1', 'FOR')).toContainText('Total12 / 16');

    // A third juror, taken off again with their scores.
    await jurors.getByRole('button', { name: 'Add juror' }).click();
    await score(page, 'Juror 3', 'FOR', [1, 1, 1, 1]);
    expect(await rows(totals.getByRole('table'))).toEqual([
      ['Side', 'Juror 1', SMITH, 'Juror 3', 'Average'],
      ['FOR', '12', '14', '4', '10'],
      ['AGAINST', '10', '11', '—', '10.5'],
    ]);
    await button(page, 'Remove Juror 3').click();
    await button(page, 'Remove juror').click();
    await expect(jurors.getByRole('button')).toHaveText(['Juror 1', SMITH, '+ Add juror']);
    expect(await rows(totals.getByRole('table'))).toEqual([
      ['Side', 'Juror 1', SMITH, 'Average'],
      ['FOR', '12', '14', '13'],
      ['AGAINST', '10', '11', '10.5'],
    ]);

    await button(page, 'Finish debate').click();

    // ── The report: the scores, averaged and per juror ──
    const results = page.getByRole('region', { name: 'Results' });
    const downloading = page.waitForEvent('download');
    await results.getByRole('button', { name: 'Download report (HTML)' }).click();
    const path = testInfo.outputPath('debate-2026-10-12.html');
    await (await downloading).saveAs(path);

    const offline = await browser.newContext();
    await offline.setOffline(true);
    const report = await offline.newPage();
    await report.goto(pathToFileURL(path).href);
    await expect(report.getByRole('heading', { name: 'Jury scores' })).toBeVisible();
    await expect(
      report.getByText('Each criterion is scored from 1 to 4; the highest total is 16.'),
    ).toBeVisible();
    const tables = report.locator('table.jury');
    await expect(tables).toHaveCount(3);
    await expect(tables.nth(0).locator('caption')).toHaveText('Average of 2 jurors');
    expect(await rows(tables.nth(0))).toEqual([
      ['Side', ...CRITERIA, 'Total'],
      ['FOR', '3.5', '2.5', '3.5', '3.5', '13'],
      ['AGAINST', '2.5', '3', '2.5', '2.5', '10.5'],
    ]);
    await expect(tables.nth(1).locator('caption')).toHaveText('Juror 1');
    expect((await rows(tables.nth(1))).slice(1)).toEqual([
      ['FOR', '3', '2', '4', '3', '12'],
      ['AGAINST', '2', '3', '3', '2', '10'],
    ]);
    await expect(tables.nth(2).locator('caption')).toHaveText(SMITH);
    expect((await rows(tables.nth(2))).slice(1)).toEqual([
      ['FOR', '4', '3', '3', '4', '14'],
      ['AGAINST', '3', '3', '2', '3', '11'],
    ]);
    await expectFits(report);
    await offline.close();

    // ── The CSV: the team's scores on each student's row ──
    const csvDownload = page.waitForEvent('download');
    await results.getByRole('button', { name: 'Download CSV' }).click();
    const lines = (await readFile(await (await csvDownload).path(), 'utf8'))
      .replace(/^﻿/, '')
      .split('\r\n');
    const header = lines[0].split(';');
    const cell = (line: number, column: string) => lines[line].split(';')[header.indexOf(column)];
    expect(header.slice(-9)).toEqual([
      'Jury: Content and arguments',
      'Jury: Rebuttal',
      'Jury: Evidence and examples',
      'Jury: Delivery',
      'Jury: total',
      'Jury: jurors',
      'Jury: total juror 1',
      'Jury: total juror 2',
      'Finished',
    ]);
    expect(cell(1, 'Student')).toBe('Ann');
    expect(cell(1, 'Jury: Content and arguments')).toBe('3.5');
    expect(cell(1, 'Jury: total')).toBe('13');
    expect(cell(1, 'Jury: jurors')).toBe('2');
    expect(cell(2, 'Student')).toBe('Bert');
    expect(cell(2, 'Jury: total')).toBe('13');
    expect(cell(3, 'Student')).toBe('Dirk');
    expect(cell(3, 'Jury: total')).toBe('10.5');
    expect(cell(3, 'Jury: total juror 1')).toBe('10');
    expect(cell(3, 'Jury: total juror 2')).toBe('11');

    // ── Share: the rubric goes with the setup, the scores stay here ──
    await tab(page, 'Share').click();
    const field = page.getByRole('textbox', { name: 'Link to this setup' });
    await expect(field).toHaveValue(/#c=[A-Za-z0-9_-]+$/);
    const link = await field.inputValue();
    const json = inside(link);
    const shared = JSON.parse(json);
    const here = await stored(page);
    expect(shared.format.rubric).toEqual(here.config.format.rubric);
    expect(shared.format.rubric.criteria.map((c: { label: string }) => c.label)).toEqual(CRITERIA);
    expect(shared.format.steps.at(-1)).toMatchObject({ id: 's1', type: 'jury' });
    // The session has the scores; the link has none of them.
    expect(here.session.debates[0].jury.jurors).toHaveLength(2);
    expect(Object.keys(shared)).toEqual(['version', 'format', 'topics']);
    for (const word of ['jurors', 'scores', SMITH, 'Ann']) expect(json).not.toContain(word);

    // A colleague sees the rubric before using the setup.
    const other = await browser.newContext();
    const colleague = await other.newPage();
    await colleague.goto(link);
    await expect(colleague.getByRole('heading', { level: 1 })).toHaveText('Use this setup?');
    const format = colleague.getByRole('region', { name: 'Format' });
    await expect(format.locator('dl > div').filter({ hasText: 'Jury rubric' })).toContainText(
      '4 criteria, 1 to 4, per team',
    );
    await expect(format.getByRole('listitem').last()).toHaveText('Delivery');
    await expectFits(colleague);
    await other.close();
  });
});
