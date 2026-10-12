import { expect, type Page } from '@playwright/test';

// Checks shared by the e2e specs. Not a spec itself: Playwright only runs
// files named *.spec.ts.

/**
 * No sideways scrolling, and no text under the 16px projector floor. Only what
 * is rendered counts: an element the browser does not show (such as the Share
 * panel's hidden file input, with the browser's default 13.33px font) is never
 * seen, so its size does not matter.
 */
export async function expectFits(page: Page) {
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
