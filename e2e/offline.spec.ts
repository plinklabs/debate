import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer, request as forward } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expectFits } from './helpers';

// Offline use and updates (#9), end to end: the app installs its service
// worker on the first visit, then loads and runs a debate with the network
// off, report included. A new deploy shows a notice and waits for the
// teacher's click, also while a clock runs. Both projects run it: Desktop
// Chrome is the 1280×720 projector, Pixel 7 the phone.

const START = new Date('2026-10-12T09:00:00');

const TOPIC = 'Graffiti verliest haar betekenis zodra ze wordt toegestaan of gesubsidieerd.';

// The families the setup screen uses (src/styles/fonts.css).
const SELF_HOSTED_FAMILIES = ['Fraunces Variable', 'Hanken Grotesk Variable', 'Space Mono'];

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const clock = (page: Page) => page.getByRole('timer', { name: 'Time' });
const notice = (page: Page) => page.getByRole('status').filter({ hasText: 'new version' });

/** Waits until the service worker is active and in charge of the page. */
async function controlled(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller !== null) return;
    await new Promise((resolve) =>
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
    );
  });
}

/** The service worker's caches, by name. */
const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

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

/** Debate 1 on topic 1, with Ann and Bert for and Dirk and Eva against, started. */
async function startDebate(page: Page) {
  await page.getByRole('tab', { name: 'Debates and teams' }).click();
  await page.getByRole('button', { name: 'Add debate' }).click();
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
  await expect(heading(page)).toHaveText(TOPIC);
}

/**
 * The app's server, behind a proxy that can play a new deploy: after
 * `deploy()`, sw.js comes with another version, as it would after a push to
 * main. The browser fetches sw.js itself, past Playwright's routing, so the
 * new version has to come from a server.
 */
async function deployableServer(app: URL) {
  let deployed = false;
  const server = createServer((incoming, outgoing) => {
    const url = new URL(incoming.url ?? '/', app);
    const changed = deployed && url.pathname === '/debate/sw.js';
    // Plain text, so sw.js can be changed; and the whole file, as it is new.
    const {
      'accept-encoding': _encoding,
      'if-none-match': _tag,
      'if-modified-since': _since,
      ...headers
    } = incoming.headers;
    const upstream = forward(
      url,
      {
        method: incoming.method,
        headers: { ...(changed ? headers : incoming.headers), host: app.host },
      },
      (response) => {
        if (!changed) {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(outgoing);
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const body = Buffer.concat(chunks)
            .toString('utf8')
            .replace(/"version":"[^"]+"/, '"version":"next"');
          const {
            'content-length': _length,
            etag: _etag,
            'last-modified': _modified,
            ...rest
          } = response.headers;
          outgoing.writeHead(response.statusCode ?? 502, rest);
          outgoing.end(body);
        });
      },
    );
    incoming.pipe(upstream);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}/debate/`,
    deploy: () => {
      deployed = true;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('can be installed as an app, with its manifest and icons', async ({ page, context }) => {
    await page.goto('./');
    await controlled(page);

    // Chrome's own checks, as DevTools shows them under Application › Manifest.
    const devtools = await context.newCDPSession(page);
    const manifest = await devtools.send('Page.getAppManifest');
    expect(manifest.errors).toEqual([]);
    expect(new URL(manifest.url).pathname).toBe('/debate/manifest.webmanifest');
    expect(JSON.parse(manifest.data ?? 'null')).toMatchObject({
      name: 'Debate — by Plink Labs',
      short_name: 'Debate',
      start_url: '/debate/',
      scope: '/debate/',
      display: 'standalone',
    });
    expect(await devtools.send('Page.getInstallabilityErrors')).toEqual({
      installabilityErrors: [],
    });

    // The service worker answers for the app's path only.
    const scope = await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistration())?.scope,
    );
    expect(new URL(scope ?? '').pathname).toBe('/debate/');
  });

  test('after one visit, loads and runs a debate with the network off, and makes its report', async ({
    page,
    context,
  }, testInfo) => {
    await page.goto('./');
    await controlled(page);
    await expect(heading(page)).toHaveText('Debate — by Plink Labs');

    // Kept: the page, its script, style sheet and .woff2 fonts, the manifest and
    // the icons; not the .woff fallbacks, and nothing outside /debate/.
    const kept = await page.evaluate(async () => {
      const [name] = await caches.keys();
      const requests = await (await caches.open(name)).keys();
      return requests.map((request) => new URL(request.url).pathname);
    });
    expect(kept).toEqual(
      expect.arrayContaining([
        '/debate/index.html',
        '/debate/manifest.webmanifest',
        '/debate/plink-mark.svg',
        '/debate/icon-192.png',
        '/debate/icon-512.png',
        '/debate/icon-maskable-512.png',
        expect.stringMatching(/^\/debate\/assets\/index-.+\.js$/),
        expect.stringMatching(/^\/debate\/assets\/index-.+\.css$/),
        expect.stringMatching(/^\/debate\/assets\/fraunces-.+\.woff2$/),
        expect.stringMatching(/^\/debate\/assets\/hanken-grotesk-.+\.woff2$/),
        expect.stringMatching(/^\/debate\/assets\/space-mono-.+\.woff2$/),
      ]),
    );
    expect(kept.filter((path) => !path.startsWith('/debate/') || path.endsWith('.woff'))).toEqual(
      [],
    );

    // ── The network goes; the app comes back, fonts and all ──
    await page.clock.install({ time: START });
    await context.setOffline(true);
    const fromNetwork: string[] = [];
    page.on('response', (response) => {
      if (!response.fromServiceWorker()) fromNetwork.push(response.url());
    });
    const failed: string[] = [];
    page.on('requestfailed', (request) => failed.push(request.url()));

    await page.reload();
    await page.clock.pauseAt(new Date(START.getTime() + 5000));
    await expect(heading(page)).toHaveText('Debate — by Plink Labs');
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.fonts]
            .filter((face) => face.status === 'loaded')
            .map((face) => face.family.replace(/^["']|["']$/g, '')),
        ),
      )
      .toEqual(expect.arrayContaining(SELF_HOSTED_FAMILIES));
    await expectFits(page);

    // ── A short debate, on the fake clock ──
    await startDebate(page);
    await page.getByRole('spinbutton', { name: 'Votes FOR' }).fill('10');
    await page.getByRole('spinbutton', { name: 'Votes AGAINST' }).fill('15');
    await goToStep(page, 'Step 2: Opening (FOR)');
    await button(page, 'Ann').click();
    await expect(button(page, 'Pause')).toBeVisible();
    await pass(page, 12_000);
    await expect(clock(page)).toHaveText('0:48');
    await expect(page.getByText('Ann has the floor')).toBeVisible();
    await goToStep(page, 'Step 10: Vote after');
    await page.getByRole('spinbutton', { name: 'Votes FOR' }).fill('13');
    await page.getByRole('spinbutton', { name: 'Votes AGAINST' }).fill('11');
    await page.getByRole('button', { name: 'Finish debate' }).click();

    // ── Its report, still offline ──
    const results = page.getByRole('region', { name: 'Results' });
    await expect(results.getByText('Debate 1 is finished.')).toBeVisible();
    const downloading = page.waitForEvent('download');
    await results.getByRole('button', { name: 'Download report (HTML)' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('debate-2026-10-12.html');
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    const report = await readFile(path, 'utf8');
    expect(report).toContain(TOPIC);
    expect(report).toContain('Ann');

    // Everything came from the service worker; nothing was left out.
    expect(fromNetwork).toEqual([]);
    expect(failed).toEqual([]);
  });

  test('offers a new deploy without ever reloading by itself, and switches to it on the click', async ({
    page,
  }, testInfo) => {
    const server = await deployableServer(new URL(testInfo.project.use.baseURL ?? ''));
    try {
      await page.clock.install({ time: START });
      await page.goto(server.url);
      await controlled(page);
      await page.clock.pauseAt(new Date(START.getTime() + 60_000));
      const [first] = await cacheNames(page);
      expect(await cacheNames(page)).toEqual([expect.stringMatching(/^debate-precache-/)]);
      await expect(notice(page)).toHaveCount(0);

      // A debate with its clock running.
      await startDebate(page);
      await goToStep(page, 'Step 2: Opening (FOR)');
      await button(page, 'Ann').click();
      await expect(button(page, 'Pause')).toBeVisible();
      // Gone if the page reloads.
      await page.evaluate(() => Object.assign(window, { sameDocument: true }));

      // ── A deploy; an hour on, the open page finds it ──
      server.deploy();
      await page.clock.fastForward('01:00:00');
      await expect(notice(page)).toContainText('A new version is ready.');
      await expect(notice(page).getByRole('button', { name: 'Reload' })).toBeVisible();
      await expectFits(page);

      // It waits: the page and its clock go on until the teacher clicks.
      const before = await clock(page).textContent();
      await pass(page, 5_000);
      await expect(clock(page)).not.toHaveText(before ?? '');
      await expect(button(page, 'Pause')).toBeVisible();
      expect(await page.evaluate(() => 'sameDocument' in window)).toBe(true);
      expect(
        await page.evaluate(
          async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state,
        ),
      ).toBe('installed');
      expect(await cacheNames(page)).toContain(first);

      // ── The click: the new version takes over, and the page reloads into it ──
      const shown = await clock(page).textContent();
      const reloaded = page.waitForEvent('load');
      await notice(page).getByRole('button', { name: 'Reload' }).click();
      await reloaded;
      expect(await page.evaluate(() => 'sameDocument' in window)).toBe(false);
      await expect(heading(page)).toHaveText(TOPIC);
      await expect(notice(page)).toHaveCount(0);
      // The debate is kept, its clock paused where it was.
      await expect(button(page, 'Start')).toBeVisible();
      await expect(clock(page)).toHaveText(shown ?? '');
      await expect.poll(() => cacheNames(page)).toEqual(['debate-precache-next']);
      expect(
        await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return {
            waiting: registration?.waiting ?? null,
            controlled: navigator.serviceWorker.controller !== null,
          };
        }),
      ).toEqual({ waiting: null, controlled: true });
    } finally {
      await server.close();
    }
  });
});
