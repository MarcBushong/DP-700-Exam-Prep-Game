import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { credentialSchema } from '../../src/features/dungeons/schema';
import { validationMetadataSchema } from '../../src/features/dungeons/threePass';
import { validateDungeonPackage } from '../../src/features/dungeons/validation';
import { scoreSession } from '../../src/features/results/scoring';
import {
  freshData,
  savedDataSchema,
  STORAGE_KEY,
} from '../../src/services/storage';

function loadDp800() {
  const read = (path: string): unknown =>
    JSON.parse(readFileSync(path, 'utf8'));
  const root = join(process.cwd(), 'src', 'content');
  const credential = credentialSchema
    .array()
    .parse(read(join(root, 'credentials', 'credentials.json')))
    .find((entry) => entry.credentialId === 'dp-800');
  if (!credential) throw new Error('DP-800 is missing from the real catalog.');
  const file = (name: string) =>
    read(join(root, 'exams', 'dp-800', `${name}.json`));
  return validateDungeonPackage(credential, {
    packageManifest: file('manifest'),
    questions: file('questions'),
    taxonomy: file('objectives'),
    manifest: file('sources'),
    reviews: file('verification-reviews'),
    encounterMetadata: file('encounter-metadata'),
    validationMetadata: file('validation-metadata'),
    sourceRegistry: file('source-registry'),
  });
}

async function saved(page: Page) {
  return savedDataSchema.parse(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      STORAGE_KEY,
    ),
  );
}

test('DP-800 Advanced Study uses reviewed facts, exact tomes, objective scores and isolated progress while DP-420 stays sealed', async ({
  page,
}) => {
  const dungeon = loadDp800();
  expect(dungeon.readiness.study).toBe(true);
  const stages = validationMetadataSchema.parse(dungeon.validationMetadata);
  await page.goto('./');
  await page
    .locator('#dungeon-dp-800')
    .getByRole('button', { name: 'Descend', exact: true })
    .click();
  await page.waitForURL(/#\/setup$/);
  await page.getByLabel('Difficulty', { exact: true }).selectOption('advanced');
  await page.getByRole('radio', { name: '5', exact: true }).check();
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  for (let index = 0; index < 5; index++) {
    await expect(
      page.locator('.question-panel .dungeon-origin'),
    ).toHaveAttribute('data-dungeon-id', 'dp-800');
    const stem = (await page.locator('legend.question-title').innerText())
      .replace(/\s+/g, ' ')
      .trim();
    const question = dungeon.questions.find(
      (candidate) => candidate.question.replace(/\s+/g, ' ').trim() === stem,
    );
    if (!question)
      throw new Error('Rendered facts are not a playable DP-800 record.');
    expect(question.difficulty).toBe('advanced');
    expect(question.verificationStatus).toBe('verified');
    expect(stages.encounters[question.id].technical?.review.verdict).toBe(
      'verified',
    );
    expect(stages.encounters[question.id].adversarial?.verdict).toBe(
      'verified',
    );
    for (const choice of question.answerChoices.filter((option) =>
      question.correctAnswer.includes(option.id),
    ))
      await page
        .getByRole(
          question.questionType === 'multi-select' ? 'checkbox' : 'radio',
          {
            name: choice.text,
            exact: true,
          },
        )
        .check();
    await page
      .getByRole('button', { name: 'Submit answer', exact: true })
      .click();
    await expect(
      page
        .locator('.question-feedback')
        .getByText(question.explanation, { exact: true }),
    ).toBeVisible();
    if (index === 0) {
      await page
        .locator('.question-feedback summary')
        .filter({ hasText: /other choices/ })
        .click();
      for (const reason of Object.values(question.whyOtherAnswersAreWrong))
        await expect(
          page.locator('.question-feedback').getByText(reason, { exact: true }),
        ).toBeVisible();
      await page
        .getByRole('button', { name: 'Open tome · view sources', exact: true })
        .click();
      const links = page.getByRole('dialog').getByRole('link');
      await expect(links).toHaveCount(question.sourceUrls.length);
      for (let source = 0; source < question.sourceUrls.length; source++) {
        await expect(links.nth(source)).toHaveAttribute(
          'href',
          question.sourceUrls[source],
        );
        await expect(links.nth(source)).toHaveAttribute(
          'rel',
          'noopener noreferrer',
        );
      }
      const popup = page.context().waitForEvent('page');
      await links.first().click();
      const tome = await popup;
      await tome.waitForLoadState('domcontentloaded');
      const opened = new URL(tome.url());
      const expected = new URL(question.sourceUrls[0]);
      expect(opened.protocol).toBe('https:');
      expect(opened.hostname).toBe('learn.microsoft.com');
      expect(opened.pathname.replace(/\/$/, '')).toBe(
        expected.pathname.replace(/\/$/, ''),
      );
      await tome.close();
      await page.keyboard.press('Escape');
    }
    await page
      .getByRole('button', {
        name: index === 4 ? 'View results' : 'Next question',
        exact: true,
      })
      .click();
  }
  await page.waitForURL(/\/results\//);
  const before = await saved(page);
  const result = before.history[0];
  const scores = scoreSession(result);
  expect(scores.percentage).toBe(100);
  expect(scores.byDungeon.map((row) => row.id)).toEqual(['dp-800']);
  expect(scores.byDomain.reduce((sum, row) => sum + row.total, 0)).toBe(5);
  expect(result.objectiveSnapshots?.['dp-800'].studyGuideEffectiveDate).toBe(
    'March 12, 2026',
  );

  await page.goto('#/dungeons/dp-420');
  const cosmos = page.locator('#dungeon-dp-420');
  await expect(
    cosmos.getByRole('button', { name: 'Sealed', exact: true }),
  ).toBeDisabled();
  await expect(
    cosmos.getByRole('button', { name: 'Boss Gauntlet', exact: true }),
  ).toBeDisabled();
  await expect(cosmos).toContainText('October 6, 2026 future outline');
  expect(
    (await saved(page)).history.find((entry) => entry.id === result.id),
  ).toEqual(result);
  expect(
    (await saved(page)).recentQuestionIdsByCredential['dp-420'] ?? [],
  ).toEqual([]);

  await page.goto('./');
  await page
    .locator('#dungeon-dp-700')
    .getByRole('button', { name: 'Descend', exact: true })
    .click();
  await page.waitForURL(/#\/setup$/);
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  await expect(page.locator('.question-panel .dungeon-origin')).toHaveAttribute(
    'data-dungeon-id',
    'dp-700',
  );
});

test('DP-800 Boss mode enforces real readiness and defers answers', async ({
  page,
}) => {
  const dungeon = loadDp800();
  await page.goto('./');
  const boss = page
    .locator('#dungeon-dp-800')
    .getByRole('button', { name: 'Boss Gauntlet', exact: true });
  if (!dungeon.readiness.gauntlet) {
    await expect(boss).toBeDisabled();
    expect(dungeon.readiness.reasons.length).toBeGreaterThan(0);
    return;
  }
  expect(dungeon.questions.length).toBeGreaterThanOrEqual(75);
  await boss.click();
  await page.waitForURL(/#\/setup$/);
  await page.getByRole('radio', { name: '5', exact: true }).check();
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  await expect(page.locator('.question-panel .dungeon-origin')).toHaveAttribute(
    'data-dungeon-id',
    'dp-800',
  );
  await expect(page.locator('.question-feedback')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Open tome · view sources', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Skip question', exact: true })
    .click();
  await expect(page.locator('.question-feedback')).toHaveCount(0);
});

test('DP-420 cannot be opened by persisted setup configuration or keyboard navigation', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('#dungeon-dp-420')).toBeVisible();
  const before = freshData();
  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          ...data,
          selectedCredentialId: 'dp-420',
          config: {
            ...data.config,
            credentialId: 'dp-420',
            runMode: 'gauntlet',
            answerMode: 'exam',
          },
        }),
      );
    },
    { key: STORAGE_KEY, data: before },
  );
  await page.goto('#/setup');
  await page.reload();
  await expect(
    page.getByText('This expedition is sealed.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Descend', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.question-panel')).toHaveCount(0);
  expect((await saved(page)).history).toEqual(before.history);
});
