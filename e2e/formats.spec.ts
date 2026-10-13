import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { expectFits } from './helpers';

// The step types and presets of #8 end to end: the Karl Popper preset picked
// and adjusted in the format editor, a debate run through a cross-examination
// with prep time called until a team's bank runs out, and audience questions,
// on Playwright's fake clock; then the report and the CSV, which record the
// new steps and the prep time. Both projects run it: Desktop Chrome is the
// 1280×720 projector, Pixel 7 the phone.

const START = new Date('2026-10-12T09:00:00');

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const currentStep = (page: Page) =>
  page.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]');

/** Time passes on the fake clock a second at a time, as it would on the wall. */
async function pass(page: Page, ms: number) {
  for (let left = ms; left > 0; left -= 1000) await page.clock.runFor(Math.min(1000, left));
}

async function goToStep(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name }).click();
  await expect(currentStep(page)).toHaveAccessibleName(name);
}

/** The cells of the rows of a table, as text. */
function rows(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((table) =>
      [...table.querySelectorAll('tr')].map((row) =>
        [...row.children].map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()),
      ),
    );
}

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('runs a Karl Popper debate with a cross-examination, prep time and audience questions, and reports them', async ({
    page,
    browser,
  }, testInfo) => {
    await page.clock.install({ time: START });
    await page.goto('./');
    await page.clock.pauseAt(new Date(START.getTime() + 5000));

    // ── Format: the Karl Popper preset, a smaller bank, and audience questions ──
    await tab(page, 'Format').click();
    await page.getByRole('combobox', { name: 'Preset' }).selectOption('Karl Popper debate');
    await button(page, 'Use this preset').click();
    await button(page, 'Replace the format').click();
    await expect(page.getByRole('textbox', { name: 'For the topic' })).toHaveValue('AFFIRMATIVE');
    await expect(page.getByRole('group', { name: /^Step \d+$/ })).toHaveCount(10);

    const crossExamination = page.getByRole('group', { name: 'Step 2', exact: true });
    const picked = (name: string) =>
      crossExamination.getByRole('combobox', { name }).locator('option:checked');
    await expect(picked('Kind')).toHaveText('Cross-examination');
    await expect(picked('Side that asks')).toHaveText('NEGATIVE');
    await expect(crossExamination.getByRole('spinbutton', { name: 'Seconds' })).toHaveValue('180');

    const prep = page.getByRole('group', { name: 'Prep time' });
    const bankOn = prep.getByRole('checkbox', { name: 'A prep-time bank for each team' });
    await expect(bankOn).toBeChecked();
    const bank = prep.getByRole('spinbutton', { name: 'Seconds per team' });
    await expect(bank).toHaveValue('240');
    await bank.fill('0');
    await expect(bank).toHaveAccessibleDescription('0 is not between 1 and 3,600.');
    await bank.fill('30');
    await expect(bank).toHaveAccessibleDescription('30 sec');
    // 44 minutes of steps, and a bank of 30 seconds for each team.
    await expect(page.getByText('Total time').locator('xpath=..')).toContainText('45 minutes');

    await button(page, 'Add step').click();
    const questions = page.getByRole('group', { name: 'Step 11', exact: true });
    await questions.getByRole('combobox', { name: 'Kind' }).selectOption('Audience questions');
    await questions.getByRole('spinbutton', { name: 'Seconds' }).fill('120');
    await expect(questions.getByRole('textbox', { name: 'Title' })).toHaveAttribute(
      'placeholder',
      'Audience questions',
    );
    await expectFits(page);

    // ── A debate of three against three ──
    await tab(page, 'Debates and teams').click();
    await button(page, 'Add debate').click();
    const debate = page.getByRole('article', { name: 'Debate 1' });
    for (const [side, names] of [
      ['AFFIRMATIVE', ['Ann', 'Bert', 'Cas']],
      ['NEGATIVE', ['Dirk', 'Eva', 'Fien']],
    ] as const) {
      const team = debate.getByRole('group', { name: side, exact: true });
      for (const [slot, name] of names.entries()) {
        await team.getByRole('textbox', { name: `Name ${slot + 1}`, exact: true }).fill(name);
      }
    }
    await debate.getByRole('button', { name: 'Start' }).click();
    await expect(currentStep(page)).toHaveAccessibleName('Step 1: Constructive (AFFIRMATIVE)');

    const bankOf = (side: string) =>
      page.getByRole('group', { name: `Prep time ${side}`, exact: true });
    const prepClock = (side: string) =>
      page.getByRole('timer', { name: `Prep time ${side}`, exact: true });
    await expect(prepClock('AFFIRMATIVE')).toHaveText('0:30');
    await expect(prepClock('NEGATIVE')).toHaveText('0:30');

    // ── Cross-examination: NEGATIVE asks, AFFIRMATIVE answers ──
    await goToStep(page, 'Step 2: Cross-examination (NEGATIVE)');
    await expect(page.getByText('Step 2 of 11 · NEGATIVE asks, AFFIRMATIVE answers')).toBeVisible();
    await expect(page.getByText('Tap who asks and who answers.')).toBeVisible();
    const clock = page.getByRole('timer', { name: 'Time', exact: true });
    await expect(clock).toHaveText('3:00');
    await page
      .getByRole('group', { name: 'NEGATIVE asks' })
      .getByRole('button', { name: 'Dirk' })
      .click();
    await page
      .getByRole('group', { name: 'AFFIRMATIVE answers' })
      .getByRole('button', { name: 'Ann' })
      .click();
    await expect(page.getByText('Dirk asks, Ann answers')).toBeVisible();
    await expect(button(page, 'Pause')).toBeVisible();
    await pass(page, 20_000);
    await expect(clock).toHaveText('2:40');
    if (testInfo.project.name === 'desktop') {
      // On the projector, the clock and both banks are in sight together.
      await expect(clock).toBeInViewport({ ratio: 1 });
      await expect(bankOf('AFFIRMATIVE')).toBeInViewport({ ratio: 1 });
      await expect(bankOf('NEGATIVE')).toBeInViewport({ ratio: 1 });
    }
    await expectFits(page);

    // ── NEGATIVE calls prep time: the cross-examination stands still ──
    await bankOf('NEGATIVE').getByRole('button', { name: 'Call prep' }).click();
    await expect(button(page, 'Start')).toBeVisible();
    await expect(bankOf('NEGATIVE').getByRole('button', { name: 'Stop prep' })).toBeVisible();
    await pass(page, 10_000);
    await expect(prepClock('NEGATIVE')).toHaveText('0:20');
    await expect(clock).toHaveText('2:40');

    // Start goes on with the step, and ends the prep time.
    await button(page, 'Start').click();
    await expect(bankOf('NEGATIVE').getByRole('button', { name: 'Call prep' })).toBeVisible();
    await pass(page, 5_000);
    await expect(clock).toHaveText('2:35');
    await expect(prepClock('NEGATIVE')).toHaveText('0:20');

    // Called again, until the bank runs out: the signal, then overtime.
    await bankOf('NEGATIVE').getByRole('button', { name: 'Call prep' }).click();
    await pass(page, 19_000);
    await expect(prepClock('NEGATIVE')).toHaveText('0:01');
    await expect(page.getByRole('status')).toHaveText('');
    await pass(page, 1_000);
    await expect(prepClock('NEGATIVE')).toHaveText('0:00');
    await expect(page.getByRole('status')).toHaveText('The prep time of NEGATIVE is up.');
    await pass(page, 5_000);
    await expect(prepClock('NEGATIVE')).toHaveText('+0:05');
    await expect(clock).toHaveText('2:35');
    await expectFits(page);
    await bankOf('NEGATIVE').getByRole('button', { name: 'Stop prep' }).click();
    await pass(page, 3_000);
    await expect(prepClock('NEGATIVE')).toHaveText('+0:05');
    await expect(prepClock('AFFIRMATIVE')).toHaveText('0:30');

    // ── Audience questions: the clock, and the answers counted per team ──
    await goToStep(page, 'Step 11: Audience questions');
    await expect(page.getByText('Step 11 of 11 · The audience and both teams')).toBeVisible();
    await button(page, 'Start').click();
    await pass(page, 30_000);
    await expect(clock).toHaveText('1:30');
    const more = (side: string) => button(page, `One answer more for ${side}`);
    await more('AFFIRMATIVE').click();
    await more('AFFIRMATIVE').click();
    await more('NEGATIVE').click();
    const answers = (side: string) => page.getByRole('group', { name: side, exact: true });
    await expect(answers('AFFIRMATIVE')).toContainText('2 answers');
    await expect(answers('NEGATIVE')).toContainText('1 answer');
    await expectFits(page);
    await button(page, 'Finish debate').click();

    // ── The report: the new steps and the prep time ──
    const results = page.getByRole('region', { name: 'Results' });
    const downloading = page.waitForEvent('download');
    await results.getByRole('button', { name: 'Download report (HTML)' }).click();
    const path = testInfo.outputPath('debate-2026-10-12.html');
    await (await downloading).saveAs(path);

    const context = await browser.newContext();
    await context.setOffline(true);
    const report = await context.newPage();
    await report.goto(pathToFileURL(path).href);
    expect(await rows(report, '.teams table:nth-of-type(2)')).toEqual([
      ['Student', 'Speeches', 'Cross-examinations', 'Turns'],
      ['Dirk', '0', '1', '1'],
      ['Eva', '0', '0', '0'],
      ['Fien', '0', '0', '0'],
    ]);
    expect(await rows(report, 'table.times')).toContainEqual([
      '02 Cross-examination NEGATIVE asks AFFIRMATIVE · Dirk → Ann',
      '3:00',
      '0:25',
      'stopped 2:35 early',
    ]);
    expect(await rows(report, 'table.times')).toContainEqual([
      '11 Audience questions The audience and both teams',
      '2:00',
      '0:30',
      'stopped 1:30 early',
    ]);
    expect(await rows(report, 'table.prep')).toEqual([
      ['Side', 'Used', 'Left'],
      ['AFFIRMATIVE', '0:00', '0:30'],
      ['NEGATIVE', '0:35', '0:00 +0:05 over time'],
    ]);
    await expect(report.getByText('Each team had 0:30.')).toBeVisible();
    expect(await rows(report, 'table.answers')).toEqual([
      ['Side', 'Answers'],
      ['AFFIRMATIVE', '2'],
      ['NEGATIVE', '1'],
    ]);
    await expectFits(report);
    await context.close();

    // ── The CSV: a role per student, the answers, each team's prep time ──
    const csvDownload = page.waitForEvent('download');
    await results.getByRole('button', { name: 'Download CSV' }).click();
    const lines = (await readFile(await (await csvDownload).path(), 'utf8'))
      .replace(/^﻿/, '')
      .split('\r\n');
    const header = lines[0].split(';');
    const cell = (line: number, column: string) => lines[line].split(';')[header.indexOf(column)];
    expect(header).toContain('02 Cross-examination (NEGATIVE) role');
    expect(header).toContain('06 Cross-examination (NEGATIVE) role');
    expect(header.slice(-5)).toEqual([
      'Prep time planned (s)',
      'Prep time used (s)',
      'Prep time left (s)',
      'Prep time overtime (s)',
      'Finished',
    ]);
    // Ann (affirmative) answered; Dirk (negative) asked.
    expect(cell(1, 'Student')).toBe('Ann');
    expect(cell(1, '02 Cross-examination (NEGATIVE) role')).toBe('answered');
    expect(cell(4, 'Student')).toBe('Dirk');
    expect(cell(4, '02 Cross-examination (NEGATIVE) role')).toBe('asked');
    expect(cell(4, '02 Cross-examination (NEGATIVE) used (s)')).toBe('25');
    expect(cell(1, 'Audience questions answers')).toBe('2');
    expect(cell(4, 'Audience questions answers')).toBe('1');
    expect(header.slice(-5).map((column) => cell(1, column))).toEqual([
      '30',
      '0',
      '30',
      '0',
      'yes',
    ]);
    expect(header.slice(-5).map((column) => cell(4, column))).toEqual([
      '30',
      '35',
      '0',
      '5',
      'yes',
    ]);
  });
});
