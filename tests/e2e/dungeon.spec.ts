import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  questionSchema,
  type Question,
} from '../../src/features/grounding/schema';
import heroClasses from '../../src/content/credentials/hero-classes.json' with { type: 'json' };

const packageRoot = join(process.cwd(), 'src', 'content', 'exams');
const banks = new Map<string, Question[]>(
  readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const file = join(packageRoot, entry.name, 'questions.json');
      if (!existsSync(file)) return [];
      return [
        [
          entry.name,
          questionSchema.array().parse(JSON.parse(readFileSync(file, 'utf8'))),
        ] as const,
      ];
    }),
);

async function encounter(page: Page) {
  const origin = await page
    .locator('.question-panel .dungeon-origin')
    .getAttribute('data-dungeon-id');
  const stem = await page.locator('legend.question-title').innerText();
  const question = banks
    .get(origin ?? '')
    ?.find(
      (item) =>
        item.question.replace(/\s+/g, ' ').trim() ===
        stem.replace(/\s+/g, ' ').trim(),
    );
  expect(
    question,
    'The visible encounter must belong to its tagged dungeon bank',
  ).toBeDefined();
  expect(question!.verificationStatus).toBe('verified');
  return { question: question!, origin: origin! };
}

async function submit(page: Page, question: Question, wrong = false) {
  const choices = wrong
    ? question.answerChoices
        .filter((choice) => !question.correctAnswer.includes(choice.id))
        .slice(0, 1)
    : question.answerChoices.filter((choice) =>
        question.correctAnswer.includes(choice.id),
      );
  for (const choice of choices)
    await page
      .getByRole(
        question.questionType === 'multi-select' ? 'checkbox' : 'radio',
        { name: choice.text, exact: true },
      )
      .check();
  await page
    .getByRole('button', { name: 'Submit answer', exact: true })
    .click();
}

test('hero, boss study, tome, cursed chambers, another dungeon, raid, and sealed gate', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const dataHero = heroClasses.find(
    (hero) => hero.id !== 'wanderer' && hero.credentialIds.includes('dp-700'),
  )!;
  await page
    .getByLabel('Hero class', { exact: true })
    .selectOption(dataHero.id);
  const fabric = page.locator('#dungeon-dp-700');
  await expect(fabric).toBeVisible();
  await fabric
    .getByRole('button', { name: 'Favorite DP-700', exact: true })
    .click();
  await expect(
    fabric.getByRole('button', { name: 'Unfavorite DP-700' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await fabric.getByRole('button', { name: 'Descend', exact: true }).click();
  await page.getByLabel('Difficulty', { exact: true }).selectOption('advanced');
  await page.getByRole('radio', { name: '5', exact: true }).check();
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  let previousReaction = '';
  for (let index = 0; index < 5; index++) {
    const { question, origin } = await encounter(page);
    expect(origin).toBe('dp-700');
    expect(question.difficulty).toBe('advanced');
    await expect(
      page.getByRole('complementary', { name: 'Boss encounter framing' }),
    ).toBeVisible();
    await submit(page, question, index === 0);
    const reaction = page.locator('.question-feedback [data-reaction-id]');
    await expect(reaction).toBeVisible();
    const reactionId = await reaction.getAttribute('data-reaction-id');
    expect(reactionId).not.toBe(previousReaction);
    previousReaction = reactionId!;
    await page
      .getByRole('button', { name: 'Open tome · view sources' })
      .click();
    const tome = page.getByRole('dialog');
    await expect(tome).toHaveAccessibleName(
      'The tome · sources behind this question',
    );
    for (const url of question.sourceUrls)
      await expect(tome.locator(`a[href="${url}"]`)).toHaveAttribute(
        'rel',
        'noopener noreferrer',
      );
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', {
        name: index === 4 ? 'View results' : 'Next question',
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole('heading', { name: 'Your floor results' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Revisit cursed chambers', exact: true })
    .click();
  await expect(page.locator('legend.question-title')).toBeVisible();
  await page.getByRole('button', { name: 'Finish early', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Finish & score session' })
    .click();
  await page.getByRole('link', { name: 'Dungeon map', exact: true }).click();
  await page.getByLabel('Hero class', { exact: true }).selectOption('wanderer');
  const otherDoors = page.locator('.dungeon-open:not(#dungeon-dp-700)');
  expect(
    await otherDoors.count(),
    'At least one independently verified representative package must be integrated',
  ).toBeGreaterThan(0);
  const otherDoor = otherDoors.first();
  const otherId = (await otherDoor.getAttribute('id'))!.replace(
    /^dungeon-/,
    '',
  );
  await otherDoor.getByRole('button', { name: 'Descend', exact: true }).click();
  await page.getByRole('radio', { name: 'Custom', exact: true }).check();
  await page.getByLabel('Custom question count (1–50)').fill('1');
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  const other = await encounter(page);
  expect(other.origin).toBe(otherId);
  await page
    .getByRole('button', { name: 'Skip question', exact: true })
    .click();
  await page.getByRole('button', { name: 'View results', exact: true }).click();
  await page.getByRole('link', { name: 'New expedition', exact: true }).click();
  await page.getByRole('radio', { name: /^Grand Raid/ }).check();
  await page
    .getByRole('group', { name: 'Choose raid dungeons (at least two)' })
    .getByRole('checkbox', { name: /^DP-700/ })
    .check();
  await page.getByRole('radio', { name: '5', exact: true }).check();
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  const raidOrigins = new Set<string>();
  for (let index = 0; index < 5; index++) {
    raidOrigins.add((await encounter(page)).origin);
    await page
      .getByRole('button', { name: 'Skip question', exact: true })
      .click();
    await page
      .getByRole('button', {
        name: index === 4 ? 'View results' : 'Next question',
        exact: true,
      })
      .click();
  }
  expect([...raidOrigins].sort()).toEqual(['dp-700', otherId].sort());
  await expect(page.locator('.raid-result-grid')).toHaveCount(2);
  await page.getByRole('link', { name: 'Dungeon map', exact: true }).click();
  const locked = page.locator('.dungeon-sealed').first();
  await expect(
    locked.getByRole('button', { name: 'Sealed', exact: true }),
  ).toBeDisabled();
  await expect(
    locked.getByRole('button', { name: 'Boss Gauntlet' }),
  ).toBeDisabled();
  await locked.getByText('Why is the gauntlet sealed?').click();
  await expect(locked.locator('.readiness-details li').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
