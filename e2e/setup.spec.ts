import { expect, test, type Page } from '@playwright/test';
import { expectFits } from './helpers';

// The setup screen end to end: the original graffiti setup of Cursus
// Esthetica built from scratch through the UI, kept over a reload, and
// started. Both projects run it: Desktop Chrome is the 1280×720 projector,
// Pixel 7 the phone.

const STORAGE_KEY = 'plinklabs:debate:v1';

const TOPIC = 'Een tag is evengoed kunst als een grote muurschildering.';

/**
 * The original format, as the teacher fills it in: kind, title, side and
 * seconds of every step, from debat-logic.ts in yvanvds/cursus-esthetica. The
 * closing statements run TEGEN before VOOR.
 */
const STEPS = [
  { kind: 'Stemming vooraf', title: 'Stemming vooraf' },
  { kind: 'Spreekbeurt', title: 'Opening', side: 'VOOR', seconds: 60 },
  { kind: 'Spreekbeurt', title: 'Opening', side: 'TEGEN', seconds: 60 },
  { kind: 'Overleg', title: 'Kort overleg', seconds: 60 },
  { kind: 'Spreekbeurt', title: 'Weerlegging', side: 'VOOR', seconds: 90 },
  { kind: 'Spreekbeurt', title: 'Weerlegging', side: 'TEGEN', seconds: 90 },
  { kind: 'Vrije ronde', title: 'Vrije ronde', seconds: 90 },
  { kind: 'Spreekbeurt', title: 'Slotwoord', side: 'TEGEN', seconds: 30 },
  { kind: 'Spreekbeurt', title: 'Slotwoord', side: 'VOOR', seconds: 30 },
  { kind: 'Stemming achteraf', title: 'Stemming achteraf' },
] as const;

/** The same steps as the app stores them, without their ids. */
const STORED_STEPS = [
  { type: 'vote-before', label: 'Stemming vooraf' },
  { type: 'speech', label: 'Opening', side: 'pro', seconds: 60 },
  { type: 'speech', label: 'Opening', side: 'con', seconds: 60 },
  { type: 'consultation', label: 'Kort overleg', seconds: 60 },
  { type: 'speech', label: 'Weerlegging', side: 'pro', seconds: 90 },
  { type: 'speech', label: 'Weerlegging', side: 'con', seconds: 90 },
  { type: 'free-round', label: 'Vrije ronde', seconds: 90 },
  { type: 'speech', label: 'Slotwoord', side: 'con', seconds: 30 },
  { type: 'speech', label: 'Slotwoord', side: 'pro', seconds: 30 },
  { type: 'vote-after', label: 'Stemming achteraf' },
];

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const step = (page: Page, number: number) =>
  page.getByRole('group', { name: `Stap ${number}`, exact: true });
const stepGroups = (page: Page) => page.getByRole('group', { name: /^Stap \d+$/ });
const debate = (page: Page, name: string) => page.getByRole('article', { name, exact: true });

async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

async function fillTeam(page: Page, side: string, names: readonly string[]) {
  const team = debate(page, 'Debat 1').getByRole('group', { name: side, exact: true });
  for (const [slot, name] of names.entries()) {
    await team.getByRole('textbox', { name: `Naam ${slot + 1}`, exact: true }).fill(name);
  }
}

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('builds the graffiti setup from scratch, keeps it over a reload, and starts a debate', async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === 'desktop') {
      expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
    }

    await page.goto('./');
    await expectFits(page);
    // The first visit was in English, so the starting setup has English labels.
    // In Dutch they stay as they were: they are the teacher's to change.
    await page.getByRole('banner').getByRole('button', { name: 'Nederlands' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Debat — door Plink Labs');

    // ── Topics: one of our own instead of the five there were ──
    await expect(tab(page, 'Stellingen')).toHaveAttribute('aria-selected', 'true');
    const newTopic = page.getByRole('textbox', { name: 'Nieuwe stelling', exact: true });
    await page.getByRole('button', { name: 'Stelling toevoegen' }).click();
    await expect(newTopic).toHaveAccessibleDescription('Dit mag niet leeg zijn.');
    await newTopic.fill(TOPIC);
    await newTopic.press('Enter');
    await expect(newTopic).toHaveValue('');
    for (let removed = 0; removed < 5; removed += 1) {
      await page.getByRole('button', { name: 'Stelling 1 verwijderen', exact: true }).click();
    }
    const topic = page.getByRole('textbox', { name: 'Stelling 1', exact: true });
    await expect(topic).toHaveValue(TOPIC);
    await expect(page.getByRole('textbox', { name: /^Stelling \d+$/ })).toHaveCount(1);
    await topic.fill('');
    await expect(topic).toHaveAccessibleDescription('Dit mag niet leeg zijn.');
    await topic.fill(TOPIC);
    await expect(topic).not.toHaveAttribute('aria-invalid');
    await expectFits(page);

    // ── Format: sides, team size, and the ten steps ──
    await tab(page, 'Debatvorm').click();
    const pro = page.getByRole('textbox', { name: 'Voor de stelling', exact: true });
    await expect(pro).toHaveValue('FOR');
    await pro.fill('VOOR');
    await page.getByRole('textbox', { name: 'Tegen de stelling', exact: true }).fill('TEGEN');

    const least = page.getByRole('spinbutton', { name: 'Minstens', exact: true });
    const most = page.getByRole('spinbutton', { name: 'Hoogstens', exact: true });
    await most.fill('9');
    await expect(most).toHaveAccessibleDescription('9 ligt niet tussen 1 en 8.');
    await most.fill('3');
    await least.fill('0');
    await expect(least).toHaveAccessibleDescription('0 ligt niet tussen 1 en 8.');
    await least.fill('2');
    await expect(least).not.toHaveAttribute('aria-invalid');

    // Every step but the first goes, and the steps are built again one by one.
    for (let count = 10; count > 1; count -= 1) {
      await page.getByRole('button', { name: `Stap ${count} verwijderen`, exact: true }).click();
    }
    await expect(stepGroups(page)).toHaveCount(1);
    await expect(step(page, 1).getByRole('textbox', { name: 'Titel' })).toHaveValue('Vote before');

    for (const [index, spec] of STEPS.entries()) {
      const number = index + 1;
      if (number > 1) {
        await page.getByRole('button', { name: 'Stap toevoegen' }).click();
        // A new step has no title yet and goes by the name of its kind.
        await expect(step(page, number).getByRole('textbox', { name: 'Titel' })).toHaveAttribute(
          'placeholder',
          'Spreekbeurt',
        );
        await expect(step(page, number).getByRole('combobox', { name: 'Soort' })).toBeFocused();
      }
      const current = step(page, number);
      await current.getByRole('combobox', { name: 'Soort' }).selectOption({ label: spec.kind });
      await current.getByRole('textbox', { name: 'Titel' }).fill(spec.title);
      if ('side' in spec) {
        await current.getByRole('combobox', { name: 'Kant' }).selectOption({ label: spec.side });
      }
      if ('seconds' in spec) {
        const seconds = current.getByRole('spinbutton', { name: /^Seconden/ });
        if (number === 2) {
          await seconds.fill('0');
          await expect(seconds).toHaveAccessibleDescription('0 ligt niet tussen 1 en 3.600.');
        }
        await seconds.fill(String(spec.seconds));
        await expect(seconds).not.toHaveAttribute('aria-invalid');
      }
    }
    await expect(stepGroups(page)).toHaveCount(10);
    await expect(page.locator('dl > div').filter({ hasText: 'Totale tijd' })).toContainText(
      '10 minuten',
    );
    await expectFits(page);

    // ── Debates: one debate, two complete teams ──
    // From the keyboard: the arrow key moves to the next tab.
    await tab(page, 'Debatvorm').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Debatten en teams')).toBeFocused();
    await expect(tab(page, 'Debatten en teams')).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('button', { name: 'Debat toevoegen' }).click();
    const first = debate(page, 'Debat 1');
    await expect(first.getByText(TOPIC)).toBeVisible();
    const start = first.getByRole('button', { name: 'Beginnen' });
    await fillTeam(page, 'VOOR', ['Ann', 'Bert', 'Cas']);
    await fillTeam(page, 'TEGEN', ['Dirk']);
    await expect(start).toBeDisabled();
    await expect(first.getByRole('group', { name: 'TEGEN' })).toHaveAccessibleDescription(
      'Minstens 2 namen nodig',
    );
    await fillTeam(page, 'TEGEN', ['Dirk', 'Eva']);
    await expect(first.getByRole('group', { name: 'TEGEN' })).toHaveAccessibleDescription(
      'Volledig',
    );
    await expect(start).toBeEnabled();
    await expectFits(page);

    // What the UI built is the original setup.
    const built = await stored(page);
    expect(built.config.topics.map((t: { text: string }) => t.text)).toEqual([TOPIC]);
    expect(built.config.format.sides).toEqual({ pro: 'VOOR', con: 'TEGEN' });
    expect(built.config.format.teamSize).toEqual({ min: 2, max: 3 });
    expect(built.config.format.steps.map(({ id: _id, ...rest }: { id: string }) => rest)).toEqual(
      STORED_STEPS,
    );

    // ── After a reload, everything is still there ──
    await page.reload();
    await expect(tab(page, 'Debatten en teams')).toHaveAttribute('aria-selected', 'true');
    await expect(first.getByText(TOPIC)).toBeVisible();
    const team = (side: string) => first.getByRole('group', { name: side, exact: true });
    await expect(team('VOOR').getByRole('textbox', { name: 'Naam 3' })).toHaveValue('Cas');
    await expect(team('TEGEN').getByRole('textbox', { name: 'Naam 2' })).toHaveValue('Eva');
    await expect(start).toBeEnabled();

    await tab(page, 'Stellingen').click();
    await expect(topic).toHaveValue(TOPIC);
    await expect(topic).toHaveAccessibleDescription('Gebruikt in 1 debat.');

    await tab(page, 'Debatvorm').click();
    await expect(pro).toHaveValue('VOOR');
    await expect(most).toHaveValue('3');
    await expect(stepGroups(page)).toHaveCount(10);
    const closing = step(page, 8);
    await expect(closing.getByRole('textbox', { name: 'Titel' })).toHaveValue('Slotwoord');
    await expect(closing.getByRole('combobox', { name: 'Kant' })).toHaveValue('con');
    await expect(closing.getByRole('spinbutton', { name: 'Seconden' })).toHaveValue('30');
    await expect(step(page, 7).getByRole('spinbutton', { name: 'Seconden per team' })).toHaveValue(
      '90',
    );

    // ── Start: the debate screen, and back ──
    await tab(page, 'Debatten en teams').click();
    await start.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOPIC);
    await expect(page.getByText('Ann, Bert, Cas')).toBeVisible();
    await expect(page.getByText('Dirk, Eva')).toBeVisible();
    await expectFits(page);
    expect((await stored(page)).session.current).toBe('d1');

    await page.getByRole('button', { name: 'Terug naar de opzet' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Debat — door Plink Labs');
    await expect(start).toBeFocused();
    expect((await stored(page)).session.current).toBeNull();
  });

  test('asks before changing the format of a debate that has results', async ({ page }) => {
    await page.goto('./');
    // A debate from an earlier lesson, with the vote before already counted.
    await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key) ?? 'null');
      const voteBefore = state.config.format.steps[0];
      state.session = {
        current: null,
        debates: [
          {
            id: 'd1',
            topicId: state.config.topics[0].id,
            teams: { pro: ['Ann', 'Bert', ''], con: ['Dirk', 'Eva', ''] },
            step: 1,
            records: { [voteBefore.id]: { type: 'vote-before', votes: { pro: 12, con: 9 } } },
            done: false,
          },
        ],
      };
      localStorage.setItem(key, JSON.stringify(state));
    }, STORAGE_KEY);
    await page.reload();

    await expect(debate(page, 'Debate 1').getByText('Started')).toBeVisible();
    await expect(debate(page, 'Debate 1').getByRole('button', { name: 'Continue' })).toBeEnabled();

    await tab(page, 'Format').click();
    const note = page.getByRole('note');
    await expect(note).toContainText('One debate already has results.');
    const seconds = page
      .getByRole('group', { name: 'Step 2', exact: true })
      .getByRole('spinbutton', { name: 'Seconds' });
    await expect(seconds).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add step' })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'For the topic' })).toBeDisabled();
    await expectFits(page);

    await note.getByRole('button', { name: 'Change the format anyway' }).click();
    await expect(note).toBeHidden();
    await seconds.fill('75');
    await expect(page.locator('dl > div').filter({ hasText: 'Total time' })).toContainText(
      '10 minutes 15 seconds',
    );
    expect((await stored(page)).config.format.steps[1].seconds).toBe(75);
    // The result is still there.
    expect((await stored(page)).session.debates[0].records['vote-before'].votes).toEqual({
      pro: 12,
      con: 9,
    });
  });
});
