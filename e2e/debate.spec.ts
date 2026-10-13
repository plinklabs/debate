import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectFits } from './helpers';

// The debate screen end to end: a whole graffiti debate run in front of the
// class, on Playwright's fake clock so every timer is exact. Both projects run
// it: Desktop Chrome is the 1280×720 projector, Pixel 7 the phone.

const STORAGE_KEY = 'plinklabs:debate:v1';
const SOUND_KEY = 'plinklabs:debate:sound';

const START = new Date('2026-10-12T09:00:00');

interface Probe {
  tones: number;
  locks: number;
}

/**
 * Counts the tones the page plays (Web Audio oscillators started) and the
 * screen wake locks it holds. The wake lock is a stand-in: a headless browser
 * may refuse a real one.
 */
async function probe(page: Page) {
  await page.addInitScript(() => {
    const probe = { tones: 0, locks: 0 };
    (window as unknown as { probe: Probe }).probe = probe;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args: Parameters<typeof start>) {
      probe.tones += 1;
      return start.apply(this, args);
    };
    const wakeLock = {
      request: async () => {
        probe.locks += 1;
        const lock = {
          released: false,
          release: async () => {
            if (lock.released) return;
            lock.released = true;
            probe.locks -= 1;
          },
        };
        return lock;
      },
    };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: wakeLock });
  });
}

const tones = (page: Page) =>
  page.evaluate(() => (window as unknown as { probe: Probe }).probe.tones);
const locks = (page: Page) =>
  page.evaluate(() => (window as unknown as { probe: Probe }).probe.locks);

async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
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
}

const currentStep = (page: Page) =>
  page.getByRole('navigation', { name: 'Steps' }).locator('[aria-current="step"]');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/**
 * What moves on the page: the ping of a running clock, the time-up signal.
 * With less motion asked for, every element still gets a transition of
 * 0.01ms (src/styles/global.css); that is no motion.
 */
const moving = (page: Page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === 'running' &&
            Number(animation.effect?.getComputedTiming().duration) > 1,
        ).length,
  );

/**
 * Time passes on the fake clock a second at a time, as it would on the wall:
 * the page draws its clocks and plans the next second in between.
 */
async function pass(page: Page, ms: number) {
  for (let left = ms; left > 0; left -= 1000) await page.clock.runFor(Math.min(1000, left));
}

/**
 * A long stretch at once, as if the laptop lid had been closed, then a last
 * second on the wall, so the page draws its clocks at the end of it.
 */
async function jump(page: Page, ms: number) {
  await page.clock.fastForward(ms - 1000);
  await page.clock.runFor(1000);
}

/**
 * The step's clock showing `time`, wholly inside its column: the digits never
 * wrap, so a time too long for the column would run out of its box (over who
 * has the floor and the names beside it) rather than widen it. The text itself
 * is measured, with a Range over the digits. Returns the size of the digits,
 * and how much of the column they fill.
 */
async function expectClockFits(page: Page, time: string, beside: readonly Locator[]) {
  await expect(page.getByRole('timer', { name: 'Time' })).toHaveText(time);
  const { text, column, overflow, fontSize } = await page
    .getByRole('timer', { name: 'Time' })
    .evaluate((digits) => {
      const range = document.createRange();
      range.selectNodeContents(digits);
      const { left, right, top, bottom } = range.getBoundingClientRect();
      const box = digits.parentElement!.getBoundingClientRect();
      return {
        text: { left, right, top, bottom },
        column: { left: box.left, right: box.right },
        overflow: digits.scrollWidth - digits.clientWidth,
        fontSize: parseFloat(getComputedStyle(digits).fontSize),
      };
    });
  expect(overflow, `${time} overflows its box`).toBe(0);
  expect(text.left, `${time} starts in its column`).toBeGreaterThanOrEqual(column.left - 0.5);
  expect(text.right, `${time} ends in its column`).toBeLessThanOrEqual(column.right + 0.5);
  for (const other of beside) {
    const box = (await other.boundingBox())!;
    const apart =
      text.right <= box.x ||
      box.x + box.width <= text.left ||
      text.bottom <= box.y ||
      box.y + box.height <= text.top;
    expect(apart, `${time} clear of “${await other.textContent()}”`).toBe(true);
  }
  await expectFits(page);
  return { fontSize, fill: (text.right - text.left) / (column.right - column.left) };
}

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('runs a whole graffiti debate, from the vote before to the shift, with the keys and the clock', async ({
    page,
  }, testInfo) => {
    const projector = testInfo.project.name === 'desktop';
    await probe(page);
    await page.clock.install({ time: START });
    await page.goto('./');
    await page.clock.pauseAt(new Date(START.getTime() + 5000));
    await startDebate(page);

    // ── Vote before: typed counts; the keys belong to the field meanwhile ──
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Graffiti verliest haar betekenis zodra ze wordt toegestaan of gesubsidieerd.',
    );
    await expect(currentStep(page)).toHaveAccessibleName('Step 1: Vote before');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Vote before');
    await expectFits(page);
    const votesFor = page.getByRole('spinbutton', { name: 'Votes FOR' });
    await votesFor.fill('10');
    await votesFor.press('ArrowRight');
    await votesFor.press('Space');
    await votesFor.press('PageDown');
    await expect(currentStep(page)).toHaveAccessibleName('Step 1: Vote before');
    await page.getByRole('spinbutton', { name: 'Votes AGAINST' }).fill('15');
    await expect(page.getByText('40%')).toBeVisible();
    await expect(page.getByText('60%')).toBeVisible();

    // Off the field, → goes on.
    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('ArrowRight');

    // ── Opening FOR: Space starts and pauses; a tap gives the floor ──
    await expect(currentStep(page)).toHaveAccessibleName('Step 2: Opening (FOR)');
    await expect(page.getByText('Step 2 of 10 · FOR')).toBeVisible();
    const clock = page.getByRole('timer', { name: 'Time' });
    await expect(clock).toHaveText('1:00');
    await page.keyboard.press('Space');
    await expect(button(page, 'Pause')).toBeVisible();
    await expect.poll(() => locks(page)).toBe(1);
    await pass(page, 20_000);
    await expect(clock).toHaveText('0:40');

    await page.keyboard.press('Space');
    await expect(button(page, 'Start')).toBeVisible();
    await expect.poll(() => locks(page)).toBe(0);
    await pass(page, 10_000);
    await expect(clock).toHaveText('0:40');
    await expect(page.getByText('Paused · of 1:00')).toBeVisible();

    await button(page, 'Ann').click();
    await expect(button(page, 'Ann')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Ann has the floor')).toBeVisible();
    await expect(button(page, 'Pause')).toBeVisible();
    if (projector) {
      // Readable from the back of the room, with the controls in reach, without scrolling.
      await expect(clock).toBeInViewport({ ratio: 1 });
      await expect(button(page, 'Pause')).toBeInViewport({ ratio: 1 });
      expect(
        await clock.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThan(150);
    }

    // ── Time is up: the signal and a sound, once; then the overtime ──
    await pass(page, 39_000);
    await expect(clock).toHaveText('0:01');
    expect(await tones(page)).toBe(0);
    await pass(page, 1_000);
    await expect(clock).toHaveText('0:00');
    await expect(page.getByRole('status')).toHaveText('Time is up.');
    await expect.poll(() => tones(page)).toBeGreaterThan(0);
    const signalled = await tones(page);
    await pass(page, 12_000);
    await expect(clock).toHaveText('+0:12');
    await expect(page.getByText('Overtime · of 1:00')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('');
    expect(await tones(page)).toBe(signalled);
    await expectFits(page);

    // ── Opening AGAINST: leaving a step pauses its clock; muted, only the signal ──
    await page.keyboard.press('PageDown');
    await expect(currentStep(page)).toHaveAccessibleName('Step 3: Opening (AGAINST)');
    await expect.poll(() => locks(page)).toBe(0);
    const sound = page.getByRole('switch', { name: 'Sound' });
    await sound.click();
    await expect(sound).toHaveAttribute('aria-checked', 'false');
    await button(page, 'Dirk').click();
    await pass(page, 60_000);
    await expect(page.getByRole('status')).toHaveText('Time is up.');
    expect(await tones(page)).toBe(signalled);
    // The opening for stands still at its overtime.
    await page.keyboard.press('PageUp');
    await expect(clock).toHaveText('+0:12');
    await pass(page, 5_000);
    await expect(clock).toHaveText('+0:12');
    await expect(page.getByRole('status')).toHaveText('');

    // ── Free round: a tap on a name switches the chess clock ──
    await page
      .getByRole('navigation', { name: 'Steps' })
      .getByRole('button', { name: 'Step 7: Free round' })
      .click();
    await expect(currentStep(page)).toHaveAccessibleName('Step 7: Free round');
    const forClock = page.getByRole('timer', { name: 'FOR' });
    const againstClock = page.getByRole('timer', { name: 'AGAINST' });
    await button(page, 'Ann').click();
    await pass(page, 5_000);
    await expect(forClock).toHaveText('1:25');
    await button(page, 'Dirk').click();
    await pass(page, 10_000);
    await expect(forClock).toHaveText('1:25');
    await expect(againstClock).toHaveText('1:20');
    await expect(page.getByText('Dirk has the floor')).toBeVisible();
    await expectFits(page);

    // ── A reload keeps everything, with the clocks paused where they were ──
    await page.reload();
    await expect(currentStep(page)).toHaveAccessibleName('Step 7: Free round');
    await expect(againstClock).toHaveText('1:20');
    await expect(forClock).toHaveText('1:25');
    await expect(button(page, 'Dirk')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, 'Start')).toBeVisible();
    await pass(page, 10_000);
    await expect(againstClock).toHaveText('1:20');
    // The sound stays off: a preference of this browser, apart from the debate.
    await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(await page.evaluate((key) => localStorage.getItem(key), SOUND_KEY)).toBe('off');
    expect(JSON.stringify(await stored(page))).not.toContain('mute');
    // Space resumes the clock of the team that had the floor.
    await page.keyboard.press('Space');
    await pass(page, 2_000);
    await expect(againstClock).toHaveText('1:18');

    // ── Vote after: the shift in percentage points, in either language ──
    for (const step of [8, 9, 10]) {
      await page.keyboard.press('PageDown');
      await expect(currentStep(page)).toHaveAccessibleName(new RegExp(`^Step ${step}:`));
    }
    await page.getByRole('spinbutton', { name: 'Votes FOR' }).fill('13');
    await page.getByRole('spinbutton', { name: 'Votes AGAINST' }).fill('11');
    await expect(page.getByText('10 FOR · 15 AGAINST · 40% FOR')).toBeVisible();
    await expect(page.getByText('13 FOR · 11 AGAINST · 54% FOR')).toBeVisible();
    await expect(page.getByText(/^Shift towards FOR/)).toHaveText(
      'Shift towards FOR: +14.2 percentage points (+3 votes)',
    );
    await expectFits(page);

    await page.getByRole('banner').getByRole('button', { name: 'Nederlands' }).click();
    await expect(page.getByText(/^Verschuiving naar FOR/)).toHaveText(
      'Verschuiving naar FOR: +14,2 procentpunten (+3 stemmen)',
    );
    await expect(
      page.getByRole('navigation', { name: 'Stappen' }).locator('[aria-current="step"]'),
    ).toHaveAccessibleName('Stap 10: Vote after');
    await expectFits(page);

    // ── Finish: back on the debates, where this one is finished ──
    await page.getByRole('button', { name: 'Debat afsluiten' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Debat — door Plink Labs');
    const card = page.getByRole('article', { name: 'Debat 1' });
    await expect(card.getByText('Afgewerkt')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Openen' })).toBeFocused();

    const { session } = await stored(page);
    expect(session.current).toBeNull();
    const [debate] = session.debates;
    expect(debate.done).toBe(true);
    expect(debate.records['vote-before'].votes).toEqual({ pro: 10, con: 15 });
    expect(debate.records['opening-pro']).toMatchObject({
      speakers: [0],
      timer: { accMs: 72_000, since: null },
    });
    expect(debate.records['opening-con']).toMatchObject({ speakers: [0] });
    expect(debate.records['free-round']).toMatchObject({
      clocks: { pro: { accMs: 5_000, since: null }, con: { accMs: 12_000, since: null } },
      teamTurns: { pro: 1, con: 1 },
    });
    expect(debate.records['vote-after'].votes).toEqual({ pro: 13, con: 11 });
  });

  test('keeps still for a viewer who asks for less motion', async ({ page }) => {
    await page.clock.install({ time: START });
    await page.goto('./');
    await page.clock.pauseAt(new Date(START.getTime() + 5000));
    await startDebate(page);
    await page.getByRole('heading', { level: 1 }).click();
    await page.keyboard.press('ArrowRight');

    // With motion, the ping of a running clock pulses.
    await page.keyboard.press('Space');
    await expect.poll(() => moving(page)).toBeGreaterThan(0);
    await page.keyboard.press('Space');

    // Without: nothing moves, not even when time is up; the signal still shows.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.press('Space');
    await expect(button(page, 'Pause')).toBeVisible();
    await expect.poll(() => moving(page)).toBe(0);
    await pass(page, 60_000);
    await expect(page.getByRole('status')).toHaveText('Time is up.');
    await expect(page.getByText('Overtime · of 1:00')).toBeVisible();
    expect(await moving(page)).toBe(0);
  });

  test('keeps the clock inside its column, however long the time it shows (#15)', async ({
    page,
  }, testInfo) => {
    const projector = testInfo.project.name === 'desktop';
    await page.clock.install({ time: START });
    await page.goto('./');
    await page.clock.pauseAt(new Date(START.getTime() + 5000));
    // The opening against takes a quarter of an hour.
    await page.getByRole('tab', { name: 'Format', exact: true }).click();
    await page
      .getByRole('group', { name: 'Step 3', exact: true })
      .getByRole('spinbutton', { name: 'Seconds' })
      .fill('900');
    await startDebate(page);
    const steps = page.getByRole('navigation', { name: 'Steps' });

    // ── A minute planned, ten minutes over: six characters ──
    await steps.getByRole('button', { name: 'Step 2: Opening (FOR)' }).click();
    await button(page, 'Ann').click();
    const forFloor = [
      page.getByText('Ann has the floor'),
      ...['Ann', 'Bert'].map((name) => button(page, name)),
    ];
    await expectClockFits(page, '1:00', forFloor);
    await jump(page, 659_000);
    await expectClockFits(page, '+9:59', forFloor);
    await pass(page, 1_000);
    const tenOver = await expectClockFits(page, '+10:00', forFloor);
    if (projector) {
      // Still as large as the column allows, to be read from the back of the room.
      expect(tenOver.fill).toBeGreaterThan(0.9);
      expect(tenOver.fontSize).toBeGreaterThan(120);
    }
    // The clock does not change size from one second to the next.
    await pass(page, 1_000);
    expect((await expectClockFits(page, '+10:01', forFloor)).fontSize).toBe(tenOver.fontSize);

    // ── A quarter of an hour planned: five characters, then six and seven ──
    await steps.getByRole('button', { name: 'Step 3: Opening (AGAINST)' }).click();
    await button(page, 'Dirk').click();
    const againstFloor = [
      page.getByText('Dirk has the floor'),
      ...['Dirk', 'Eva'].map((name) => button(page, name)),
    ];
    const quarter = await expectClockFits(page, '15:00', againstFloor);
    if (projector) expect(quarter.fill).toBeGreaterThan(0.9);
    // Nor when it comes down under ten minutes, or reaches the overtime.
    await jump(page, 301_000);
    expect((await expectClockFits(page, '9:59', againstFloor)).fontSize).toBe(quarter.fontSize);
    await jump(page, 600_000);
    expect((await expectClockFits(page, '+0:01', againstFloor)).fontSize).toBe(quarter.fontSize);
    await jump(page, 599_000);
    const quarterOver = await expectClockFits(page, '+10:00', againstFloor);
    await jump(page, 5_400_000);
    const hundredOver = await expectClockFits(page, '+100:00', againstFloor);
    if (projector) {
      expect(quarterOver.fill).toBeGreaterThan(0.9);
      expect(hundredOver.fill).toBeGreaterThan(0.9);
    }
  });
});
