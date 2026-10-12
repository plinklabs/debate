import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

// Sharing a setup end to end: as a link opened in another browser, as a file
// downloaded and opened again, and what a broken or newer link or file says.
// Both projects run it: Desktop Chrome is the 1280×720 projector, Pixel 7 the
// phone.

const STORAGE_KEY = 'plinklabs:debate:v1';

const TOPIC = 'Homework should be banned.';

/** Session data: it stays in the browser where it was typed. */
const NAMES = ['Annelies', 'Bertrand', 'Dirkjan', 'Evangeline'];

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const step = (page: Page, number: number) =>
  page.getByRole('group', { name: `Step ${number}`, exact: true });

async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

/** The JSON inside a link, unpacked by Node rather than by the app. */
function inside(link: string): string {
  return inflateRawSync(Buffer.from(link.split('#c=')[1], 'base64url')).toString('utf8');
}

/** A link made by Node rather than by the app: deflate-raw, then base64url. */
function linkTo(page: Page, json: unknown): string {
  const encoded = deflateRawSync(Buffer.from(JSON.stringify(json))).toString('base64url');
  return new URL(`./#c=${encoded}`, page.url()).href;
}

/** A debate on topic 1 with names on both teams and the vote before counted. */
async function seedDebateWithResults(page: Page) {
  await page.evaluate(
    ({ key, names }) => {
      const state = JSON.parse(localStorage.getItem(key) ?? 'null');
      state.session = {
        current: null,
        debates: [
          {
            id: 'd1',
            topicId: state.config.topics[0].id,
            teams: { pro: [names[0], names[1], ''], con: [names[2], names[3], ''] },
            step: 1,
            records: { 'vote-before': { type: 'vote-before', votes: { pro: 12, con: 9 } } },
            done: false,
          },
        ],
      };
      localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, names: NAMES },
  );
  await page.reload();
}

/**
 * No sideways scrolling, and no text under the 16px projector floor (as in
 * setup.spec.ts, but only on what is rendered: the Share panel's file input is
 * hidden behind its button).
 */
async function expectFits(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  const tooSmall = await page.evaluate(() => {
    const found: string[] = [];
    for (const element of document.body.querySelectorAll('*')) {
      if (!element.checkVisibility()) continue;
      const hasText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
      );
      const isControl = element.matches('input, textarea, select, button');
      if (!hasText && !isControl) continue;
      const size = parseFloat(getComputedStyle(element).fontSize);
      if (size < 16) found.push(`${element.tagName} “${element.textContent?.trim()}”: ${size}px`);
    }
    return found;
  });
  expect(tooSmall).toEqual([]);
}

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('shares a setup as a link that another browser previews and uses', async ({
    page,
    context,
    browser,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('./');

    // ── A setup of our own, and a debate with names that must stay here ──
    await page.getByRole('textbox', { name: 'Topic 1', exact: true }).fill(TOPIC);
    await tab(page, 'Format').click();
    await page.getByRole('textbox', { name: 'For the topic', exact: true }).fill('PRO');
    await page.getByRole('textbox', { name: 'Against the topic', exact: true }).fill('CONTRA');
    await step(page, 2).getByRole('spinbutton', { name: 'Seconds' }).fill('75');
    await tab(page, 'Debates and teams').click();
    await page.getByRole('button', { name: 'Add debate' }).click();
    const debate = page.getByRole('article', { name: 'Debate 1' });
    for (const [index, name] of NAMES.entries()) {
      const team = debate.getByRole('group', { name: index < 2 ? 'PRO' : 'CONTRA', exact: true });
      await team.getByRole('textbox', { name: `Name ${(index % 2) + 1}`, exact: true }).fill(name);
    }

    // ── Share: the link, copied ──
    await tab(page, 'Share').click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Share');
    const field = page.getByRole('textbox', { name: 'Link to this setup' });
    await expect(field).toHaveValue(/#c=[A-Za-z0-9_-]+$/);
    const link = await field.inputValue();
    expect(link.startsWith(new URL('./#c=', page.url()).href)).toBe(true);
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByRole('status')).toHaveText('Link copied.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    await expectFits(page);

    // The setup is in the link, the class is not.
    const json = inside(link);
    expect(JSON.parse(json)).toEqual((await stored(page)).config);
    for (const name of NAMES) expect(json).not.toContain(name);

    // ── Another browser: nothing stored there yet ──
    // A context of its own, with the project's device and this test's locale.
    const other = await browser.newContext();
    const colleague = await other.newPage();
    expect(colleague.viewportSize()).toEqual(page.viewportSize());
    await colleague.goto(link);

    await expect(heading(colleague)).toHaveText('Use this setup?');
    await expect(colleague.getByText('This setup comes from a link.')).toBeVisible();
    const topics = colleague.getByRole('region', { name: 'Topics' });
    await expect(topics.getByRole('listitem').first()).toHaveText(TOPIC);
    await expect(topics.getByRole('listitem')).toHaveCount(5);
    const format = colleague.getByRole('region', { name: 'Format' });
    await expect(format.locator('dl > div').filter({ hasText: 'Total time' })).toContainText(
      '10 minutes 15 seconds',
    );
    await expect(format.locator('dl > div').filter({ hasText: 'For the topic' })).toContainText(
      'PRO',
    );
    await expect(format.locator('dl > div').filter({ hasText: 'Against the topic' })).toContainText(
      'CONTRA',
    );
    await expect(format.getByRole('listitem').nth(1)).toHaveText(
      'OpeningSpeech · PRO · 1 min 15 sec',
    );
    // Nothing changes before the colleague says so.
    expect((await stored(colleague)).config.topics[0].text).not.toBe(TOPIC);
    await expectFits(colleague);

    await colleague.getByRole('button', { name: 'Use this setup' }).click();

    await expect(heading(colleague)).toHaveText('Debate — by Plink Labs');
    await expect(colleague).toHaveURL(/\/debate\/$/);
    await expect(tab(colleague, 'Topics')).toHaveAttribute('aria-selected', 'true');
    await expect(colleague.getByRole('textbox', { name: 'Topic 1', exact: true })).toHaveValue(
      TOPIC,
    );
    await tab(colleague, 'Format').click();
    await expect(colleague.getByRole('textbox', { name: 'For the topic' })).toHaveValue('PRO');
    await expect(step(colleague, 2).getByRole('spinbutton', { name: 'Seconds' })).toHaveValue('75');
    await tab(colleague, 'Debates and teams').click();
    await expect(colleague.getByText('No debates yet.', { exact: false })).toBeVisible();

    // A reload keeps the setup and does not ask again.
    await colleague.reload();
    await expect(heading(colleague)).toHaveText('Debate — by Plink Labs');
    expect((await stored(colleague)).config).toEqual((await stored(page)).config);
    await other.close();
  });

  test('says what a shared setup does to debates that have results, before it is used', async ({
    page,
  }) => {
    await page.goto('./');
    await seedDebateWithResults(page);
    const before = await stored(page);
    const shared = {
      ...before.config,
      format: { ...before.config.format, sides: { pro: 'PRO', con: 'CONTRA' } },
      topics: [{ id: 't1', text: TOPIC }, ...before.config.topics.slice(1)],
    };

    // The link arrives while the app is open.
    const link = linkTo(page, shared);
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, new URL(link).hash);

    await expect(heading(page)).toHaveText('Use this setup?');
    const note = page.getByRole('note');
    await expect(note).toContainText(
      'There is one debate in this browser, and it already has results. It stays, but follows this setup from now on:',
    );
    await expect(note.getByRole('listitem')).toHaveText([
      `Debate 1 will be about “${TOPIC}”`,
      'The format changes: a step this format does not have drops out of the results, and a new duration changes the time that was planned.',
    ]);
    await expectFits(page);

    // Cancel: nothing changed, and the link is gone from the address.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(heading(page)).toHaveText('Debate — by Plink Labs');
    await expect(page).toHaveURL(/\/debate\/$/);
    expect(await stored(page)).toEqual(before);
    await page.reload();
    await expect(heading(page)).toHaveText('Debate — by Plink Labs');

    // Used after all: the debate stays, with its names and its result.
    await page.goto(link);
    await page.getByRole('button', { name: 'Use this setup' }).click();
    await expect(heading(page)).toHaveText('Debate — by Plink Labs');
    const after = await stored(page);
    expect(after.config).toEqual(shared);
    expect(after.session).toEqual(before.session);
    await tab(page, 'Debates and teams').click();
    const debate = page.getByRole('article', { name: 'Debate 1' });
    await expect(debate.getByText(TOPIC)).toBeVisible();
    await expect(debate.getByText('Started')).toBeVisible();
    await expect(debate.getByRole('group', { name: 'PRO', exact: true })).toBeVisible();
  });

  test('says what is wrong with a broken link, or one from a newer version', async ({ page }) => {
    await page.goto('./');
    const before = await stored(page);
    const good = linkTo(page, before.config);

    // Cut short, as a chat app or a careless copy might.
    await page.goto(good.slice(0, -16));
    await expect(heading(page)).toHaveText('This link cannot be used');
    await expect(page.getByRole('alert')).toHaveText(
      'This link is damaged or incomplete. Copy the whole link again, or ask for a new one.',
    );
    await expect(page.getByRole('button', { name: 'Use this setup' })).toHaveCount(0);
    await expectFits(page);

    await page.getByRole('button', { name: 'Continue to the app' }).click();
    await expect(heading(page)).toHaveText('Debate — by Plink Labs');
    await expect(page).toHaveURL(/\/debate\/$/);
    expect((await stored(page)).config).toEqual(before.config);

    // Made by a newer version of the app.
    await page.goto(linkTo(page, { ...before.config, version: 2 }));
    await expect(heading(page)).toHaveText('This link cannot be used');
    await expect(page.getByRole('alert')).toContainText(
      'This setup was made with a newer version of the app (version 2; this one reads up to version 1).',
    );

    // A setup with something wrong in it says where.
    const steps = before.config.format.steps.map((s: object, i: number) =>
      i === 1 ? { ...s, seconds: 0 } : s,
    );
    await page.goto(
      linkTo(page, {
        ...before.config,
        format: { ...before.config.format, steps },
        topics: [{ id: 't9', text: ' ' }, ...before.config.topics],
      }),
    );
    await expect(page.getByRole('alert').getByRole('listitem')).toHaveText([
      'Step 2: 0 is not between 1 and 3,600.',
      'Topic 1: This cannot be empty.',
    ]);
  });

  test('exports the setup as a file, and another browser opens it', async ({
    page,
    browser,
  }, testInfo) => {
    await page.goto('./');
    await seedDebateWithResults(page);
    await tab(page, 'Topics').click();
    await page.getByRole('textbox', { name: 'Topic 2', exact: true }).fill(TOPIC);
    await tab(page, 'Share').click();

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download file' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('debate-setup.json');
    const path = testInfo.outputPath('debate-setup.json');
    await download.saveAs(path);

    // Pretty-printed JSON of the setup, and nothing about the class.
    const text = await readFile(path, 'utf8');
    expect(text.startsWith('{\n  "version": 1,\n  "format": {\n')).toBe(true);
    expect(JSON.parse(text)).toEqual((await stored(page)).config);
    for (const name of NAMES) expect(text).not.toContain(name);
    expect(text).not.toMatch(/debates|records|votes/);

    // ── Another browser opens the file ──
    // A context of its own, with the project's device and this test's locale.
    const other = await browser.newContext();
    const colleague = await other.newPage();
    await colleague.goto('./');
    await tab(colleague, 'Share').click();
    const choosing = colleague.waitForEvent('filechooser');
    await colleague.getByRole('button', { name: 'Open a file' }).click();
    await (await choosing).setFiles(path);

    await expect(heading(colleague)).toHaveText('Use this setup?');
    await expect(
      colleague.getByText(
        'This setup comes from the file “debate-setup.json”. Nothing changes until you choose to use it.',
      ),
    ).toBeVisible();
    await expect(
      colleague.getByRole('region', { name: 'Topics' }).getByRole('listitem').nth(1),
    ).toHaveText(TOPIC);
    await colleague.getByRole('button', { name: 'Use this setup' }).click();

    await expect(tab(colleague, 'Topics')).toHaveAttribute('aria-selected', 'true');
    await expect(colleague.getByRole('textbox', { name: 'Topic 2', exact: true })).toHaveValue(
      TOPIC,
    );
    expect((await stored(colleague)).config).toEqual((await stored(page)).config);
    expect((await stored(colleague)).session.debates).toEqual([]);

    // A file that is not a setup says so, and the app goes on as it was.
    await tab(colleague, 'Share').click();
    const choosingAgain = colleague.waitForEvent('filechooser');
    await colleague.getByRole('button', { name: 'Open a file' }).click();
    await (
      await choosingAgain
    ).setFiles({
      name: 'class-list.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ students: NAMES })),
    });
    await expect(heading(colleague)).toHaveText('This file cannot be used');
    await expect(colleague.getByRole('alert')).toContainText('Version: This field is missing.');
    await colleague.getByRole('button', { name: 'Continue to the app' }).click();
    await expect(tab(colleague, 'Share')).toHaveAttribute('aria-selected', 'true');
    await other.close();
  });

  test('selects the link for copying by hand when the browser cannot copy', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined });
    });
    await page.goto('./');
    await tab(page, 'Share').click();
    const field = page.getByRole('textbox', { name: 'Link to this setup' });
    await expect(field).toHaveValue(/#c=/);

    await page.getByRole('button', { name: 'Copy link' }).click();

    await expect(page.getByRole('status')).toHaveText(
      'This browser does not let the app copy. The link is selected: copy it with Ctrl+C, or Cmd+C on a Mac.',
    );
    await expect(field).toBeFocused();
    const selection = await field.evaluate((input: HTMLInputElement) => ({
      start: input.selectionStart,
      end: input.selectionEnd,
      length: input.value.length,
    }));
    expect(selection).toEqual({ start: 0, end: selection.length, length: selection.length });
    await expectFits(page);

    // The Share panel fits in Dutch too, with its longer words.
    await page.getByRole('banner').getByRole('button', { name: 'Nederlands' }).click();
    await expect(tab(page, 'Delen')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Link kopiëren' })).toBeVisible();
    await expectFits(page);
  });
});
