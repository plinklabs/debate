import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { expectFits } from './helpers';

// The results report end to end (#7): a short debate run on Playwright's fake
// clock, its report downloaded and opened with the network off, printed on
// A4, loaded back into another browser, and the CSV next to it. Both projects
// run it: Desktop Chrome is the 1280×720 projector, Pixel 7 the phone.

const STORAGE_KEY = 'plinklabs:debate:v1';

const START = new Date('2026-10-12T09:00:00');

/** Typed by a student, and shown as text everywhere, the report included. */
const EVA = 'Eva</script>';

const TOPIC = 'Graffiti verliest haar betekenis zodra ze wordt toegestaan of gesubsidieerd.';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

/** Time passes on the fake clock a second at a time, as it would on the wall. */
async function pass(page: Page, ms: number) {
  for (let left = ms; left > 0; left -= 1000) await page.clock.runFor(Math.min(1000, left));
}

async function goToStep(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name }).click();
  await expect(
    page.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]'),
  ).toHaveAccessibleName(name);
}

/**
 * Debate 1, run short and finished: the votes 10–15 and 13–11, the opening
 * for 72 s by Ann (12 over), the opening against 45 s by Dirk (15 early), and
 * in the free round 5 s for Ann and 12 s for Eva.
 */
async function runShortDebate(page: Page) {
  await tab(page, 'Debates and teams').click();
  await page.getByRole('button', { name: 'Add debate' }).click();
  const debate = page.getByRole('article', { name: 'Debate 1' });
  for (const [side, names] of [
    ['FOR', ['Ann', 'Bert']],
    ['AGAINST', ['Dirk', EVA]],
  ] as const) {
    const team = debate.getByRole('group', { name: side, exact: true });
    for (const [slot, name] of names.entries()) {
      await team.getByRole('textbox', { name: `Name ${slot + 1}`, exact: true }).fill(name);
    }
  }
  await debate.getByRole('button', { name: 'Start' }).click();

  await page.getByRole('spinbutton', { name: 'Votes FOR' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Votes AGAINST' }).fill('15');

  await goToStep(page, 'Step 2: Opening (FOR)');
  await button(page, 'Ann').click();
  await pass(page, 72_000);
  await goToStep(page, 'Step 3: Opening (AGAINST)');
  await button(page, 'Dirk').click();
  await pass(page, 45_000);

  await goToStep(page, 'Step 7: Free round');
  await button(page, 'Ann').click();
  await pass(page, 5_000);
  await button(page, EVA).click();
  await pass(page, 12_000);

  await goToStep(page, 'Step 10: Vote after');
  await page.getByRole('spinbutton', { name: 'Votes FOR' }).fill('13');
  await page.getByRole('spinbutton', { name: 'Votes AGAINST' }).fill('11');
  await page.getByRole('button', { name: 'Finish debate' }).click();
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

  test('makes a report that opens offline, prints on A4 and loads back into another browser', async ({
    page,
    browser,
  }, testInfo) => {
    await page.clock.install({ time: START });
    await page.goto('./');
    await page.clock.pauseAt(new Date(START.getTime() + 5000));
    await runShortDebate(page);

    // ── Back on the debates, the results offer the report ──
    const results = page.getByRole('region', { name: 'Results' });
    await expect(results.getByText('Debate 1 is finished.')).toBeVisible();
    await expectFits(page);

    const downloading = page.waitForEvent('download');
    await results.getByRole('button', { name: 'Download report (HTML)' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('debate-2026-10-12.html');
    const path = testInfo.outputPath('debate-2026-10-12.html');
    await download.saveAs(path);

    // Self-contained: nothing to fetch, and one script element, which holds data.
    const html = await readFile(path, 'utf8');
    expect(html).not.toMatch(/https?:|\bsrc=|\bhref=|url\(|@import/i);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).toContain('<script type="application/json" id="debate-session">');

    // ── The report, opened in a browser with the network off ──
    const offline = await browser.newContext();
    await offline.setOffline(true);
    const requests: string[] = [];
    offline.on('request', (request) => requests.push(request.url()));
    await offline.route('**', (route) =>
      route.request().url().startsWith('file:') ? route.continue() : route.abort(),
    );
    const report = await offline.newPage();
    await report.goto(pathToFileURL(path).href);

    await expect(report).toHaveTitle('Debate report — October 12, 2026');
    await expect(heading(report)).toHaveText('Debate report');
    await expect(report.getByText('October 12, 2026 · 1 debate with results')).toBeVisible();
    const debate = report.getByRole('region', { name: 'Debate 1' });
    await expect(debate.getByText('Finished', { exact: true })).toBeVisible();
    await expect(debate.getByText(TOPIC)).toBeVisible();
    expect(await rows(report, '.teams table:nth-of-type(2)')).toEqual([
      ['Student', 'Speeches', 'Free round', 'Turns'],
      ['Dirk', '1', '0', '1'],
      [EVA, '0', '1', '1'],
    ]);
    const times = await rows(report, 'table.times');
    expect(times.slice(0, 3)).toEqual([
      ['Step', 'Planned', 'Used', 'Difference'],
      ['02 Opening FOR · Ann', '1:00', '1:12', '+0:12 over time'],
      ['03 Opening AGAINST · Dirk', '1:00', '0:45', 'stopped 0:15 early'],
    ]);
    expect(times).toContainEqual(['07 Free round AGAINST', '1:30', '0:12', 'stopped 1:18 early']);
    expect(await rows(report, 'table.balance')).toEqual([
      ['Side', 'Time used', 'Share', 'Team turns'],
      ['FOR', '0:05', '29%', '1'],
      ['AGAINST', '0:12', '71%', '1'],
    ]);
    expect(await rows(report, 'table.vote')).toEqual([
      ['', 'FOR', 'AGAINST', 'Share FOR'],
      ['Before', '10', '15', '40%'],
      ['After', '13', '11', '54%'],
    ]);
    await expect(debate.getByText(/^Shift towards FOR/)).toHaveText(
      'Shift towards FOR: +14.2 percentage points (+3 votes)',
    );
    // The name is text: it did not end the data or add an element.
    expect(await report.locator('script').count()).toBe(1);
    expect(requests.filter((url) => !url.startsWith('file:'))).toEqual([]);
    await expectFits(report);

    // ── Printed on A4: nothing wider than the page ──
    await report.emulateMedia({ media: 'print' });
    // 210 mm less 2 × 14 mm of margin, at 96 px to the inch.
    await report.setViewportSize({ width: 688, height: 1000 });
    const printed = await report.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      wider: [...document.querySelectorAll('table')].filter(
        (table) => table.getBoundingClientRect().right > document.documentElement.clientWidth,
      ).length,
      note: getComputedStyle(document.querySelector('.note') as Element).display,
    }));
    expect(printed).toEqual({ overflow: 0, wider: 0, note: 'none' });
    await offline.close();

    // ── The CSV, for a spreadsheet ──
    const csvDownload = page.waitForEvent('download');
    await results.getByRole('button', { name: 'Download CSV' }).click();
    const csv = await csvDownload;
    expect(csv.suggestedFilename()).toBe('debate-2026-10-12.csv');
    const bytes = await readFile(await csv.path());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = bytes.subarray(3).toString('utf8').split('\r\n');
    expect(lines.at(-1)).toBe('');
    expect(lines[0].split(';').slice(0, 8)).toEqual([
      'Debate',
      'Topic',
      'Side',
      'Student',
      'Team members',
      'Turns',
      'Votes FOR before',
      'Votes AGAINST before',
    ]);
    expect(lines).toHaveLength(1 + 4 + 1);
    const ann = lines[1].split(';');
    expect(ann.slice(0, 6)).toEqual(['1', TOPIC, 'FOR', 'Ann', 'Ann, Bert', '2']);
    expect(ann.slice(-3)).toEqual(['3', '14.2', 'yes']);

    // In Dutch: Dutch headers and a decimal comma.
    await page.getByRole('banner').getByRole('button', { name: 'Nederlands' }).click();
    const dutchDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV downloaden' }).click();
    const dutch = await dutchDownload;
    expect(dutch.suggestedFilename()).toBe('debat-2026-10-12.csv');
    const dutchLines = (await readFile(await dutch.path(), 'utf8')).split('\r\n');
    expect(dutchLines[0].startsWith('﻿Debat;Stelling;Kant;Leerling;Teamleden;')).toBe(true);
    expect(dutchLines[1].split(';').slice(-3)).toEqual(['3', '14,2', 'ja']);

    // ── Another browser loads the report back ──
    const other = await browser.newContext();
    const colleague = await other.newPage();
    await colleague.goto('./');
    await tab(colleague, 'Debates and teams').click();
    await expect(colleague.getByRole('region', { name: 'Results' })).toContainText(
      'No results yet.',
    );
    const choosing = colleague.waitForEvent('filechooser');
    await colleague.getByRole('button', { name: 'Open a report' }).click();
    await (await choosing).setFiles(path);

    await expect(heading(colleague)).toHaveText('Load this report?');
    await expect(
      colleague.getByText('This report comes from the file “debate-2026-10-12.html”.', {
        exact: false,
      }),
    ).toBeVisible();
    const listed = colleague.getByRole('region', { name: 'Debates in the report' });
    await expect(listed.getByRole('listitem')).toHaveCount(1);
    await expect(listed).toContainText(`FOR: Ann, Bert · AGAINST: Dirk, ${EVA}`);
    await expectFits(colleague);
    // Nothing changes before the colleague says so.
    expect((await stored(colleague)).session.debates).toEqual([]);

    await colleague.getByRole('button', { name: 'Load report' }).click();

    await expect(heading(colleague)).toHaveText('Debate — by Plink Labs');
    await expect(tab(colleague, 'Debates and teams')).toHaveAttribute('aria-selected', 'true');
    const card = colleague.getByRole('article', { name: 'Debate 1' });
    await expect(card.getByText('Finished')).toBeVisible();
    await expect(
      card.getByRole('group', { name: 'AGAINST', exact: true }).getByRole('textbox').nth(1),
    ).toHaveValue(EVA);
    // The same session and setup as where the report was made.
    const original = await stored(page);
    const restored = await stored(colleague);
    expect(restored.session).toEqual(original.session);
    expect(restored.config).toEqual(original.config);

    // And it goes on there: the debate opens at the step it was left on.
    await card.getByRole('button', { name: 'Open' }).click();
    await expect(heading(colleague)).toHaveText(TOPIC);
    await expect(
      colleague.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]'),
    ).toHaveAccessibleName('Step 10: Vote after');
    await other.close();
  });
});
