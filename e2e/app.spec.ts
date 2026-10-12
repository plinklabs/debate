import { expect, test, type Response } from '@playwright/test';

// The families the placeholder page uses, as fontsource names them
// (display, body and mono; see src/styles/fonts.css).
const SELF_HOSTED_FAMILIES = ['Fraunces Variable', 'Hanken Grotesk Variable', 'Space Mono'];

test('loads the app with its heading and self-hosted fonts', async ({ page }) => {
  const fontResponses: Response[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'font') fontResponses.push(response);
  });

  await page.goto('./');

  await expect(page).toHaveURL(/\/debate\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Debate — by Plink Labs');

  // Each family has finished loading at least one face.
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.fonts]
          .filter((face) => face.status === 'loaded')
          .map((face) => face.family.replace(/^["']|["']$/g, '')),
      ),
    )
    .toEqual(expect.arrayContaining(SELF_HOSTED_FAMILIES));

  // ...and every font file came from this origin, under the base path.
  expect(fontResponses.length).toBeGreaterThan(0);
  const origin = new URL(page.url()).origin;
  for (const response of fontResponses) {
    const url = new URL(response.url());
    expect(url.origin, url.href).toBe(origin);
    expect(url.pathname, url.href).toMatch(/^\/debate\/assets\/.+\.woff2$/);
    expect(response.ok(), url.href).toBe(true);
  }
});
