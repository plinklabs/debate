import { expect, test, type Page } from '@playwright/test';

const ENGLISH = 'Debate — by Plink Labs';
const DUTCH = 'Debat — door Plink Labs';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const languageButton = (page: Page, name: 'English' | 'Nederlands') =>
  page.getByRole('banner').getByRole('button', { name });

/** The text, `<html lang>`, the title and the switch all show `language`. */
async function expectLanguage(page: Page, language: 'en' | 'nl') {
  const title = language === 'en' ? ENGLISH : DUTCH;
  await expect(heading(page)).toHaveText(title);
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page).toHaveTitle(title);
  await expect(languageButton(page, 'English')).toHaveAttribute(
    'aria-pressed',
    String(language === 'en'),
  );
  await expect(languageButton(page, 'Nederlands')).toHaveAttribute(
    'aria-pressed',
    String(language === 'nl'),
  );
}

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('switches to Dutch and back, and remembers the choice after a reload', async ({ page }) => {
    await page.goto('./');
    await expectLanguage(page, 'en');
    await expect(page.getByText('// Work in progress')).toBeVisible();

    await languageButton(page, 'Nederlands').click();

    await expectLanguage(page, 'nl');
    await expect(page.getByText('// In aanbouw')).toBeVisible();
    await expect(page.getByText(/^Stellingen, teams, spreektijden/)).toBeVisible();

    await page.reload();
    await expectLanguage(page, 'nl');

    await languageButton(page, 'English').click();
    await expectLanguage(page, 'en');

    await page.reload();
    await expectLanguage(page, 'en');
  });

  test('fits the header on the screen in both languages', async ({ page }) => {
    await page.goto('./');
    for (const name of ['Nederlands', 'English'] as const) {
      await languageButton(page, name).click();
      const button = languageButton(page, name);
      await expect(button).toBeInViewport({ ratio: 1 });
      // The 16px floor holds for the switch too.
      expect(await button.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    }
  });
});

test.describe('in a Dutch browser', () => {
  test.use({ locale: 'nl-BE' });

  test("opens in the browser's language", async ({ page }) => {
    await page.goto('./');
    await expectLanguage(page, 'nl');
  });

  test("keeps English once chosen, over the browser's language", async ({ page }) => {
    await page.goto('./');
    await languageButton(page, 'English').click();
    await expectLanguage(page, 'en');

    await page.reload();
    await expectLanguage(page, 'en');
  });
});
