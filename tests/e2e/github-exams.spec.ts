import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { questionSchema } from '../../src/features/grounding/schema';
import { validationMetadataSchema } from '../../src/features/dungeons/threePass';
import { credentialSchema } from '../../src/features/dungeons/schema';
import { scoreSession } from '../../src/features/results/scoring';
import { savedDataSchema, STORAGE_KEY } from '../../src/services/storage';

const read = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const packages = join(process.cwd(), 'src', 'content', 'exams');
const githubId = 'github-copilot';
const agenticId = 'github-agentic-ai-developer';
const githubQuestions = questionSchema
  .array()
  .parse(read(join(packages, githubId, 'questions.json')));
const stages = validationMetadataSchema.parse(
  read(join(packages, githubId, 'validation-metadata.json')),
);
const catalog = credentialSchema
  .array()
  .parse(
    read(
      join(process.cwd(), 'src', 'content', 'credentials', 'credentials.json'),
    ),
  );

async function saved(page: Page) {
  return savedDataSchema.parse(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      STORAGE_KEY,
    ),
  );
}

test('GH-300 three-pass study, sources, isolated progress, GH-600 beta play, and DP-700 regression', async ({
  page,
}) => {
  await page.goto('./');
  await page
    .locator(`#dungeon-${githubId}`)
    .getByRole('button', { name: 'Descend', exact: true })
    .click();
  await page.getByLabel('Difficulty', { exact: true }).selectOption('advanced');
  await page.getByRole('radio', { name: '5', exact: true }).check();
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  for (let index = 0; index < 5; index++) {
    await expect(
      page.getByRole('button', { name: 'Submit answer', exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('.question-panel .dungeon-origin'),
    ).toHaveAttribute('data-dungeon-id', githubId);
    const stem = (await page.locator('legend.question-title').innerText())
      .replace(/\s+/g, ' ')
      .trim();
    const question = githubQuestions.find(
      (candidate) => candidate.question.replace(/\s+/g, ' ').trim() === stem,
    );
    if (!question)
      throw new Error(
        'The rendered GH-300 question does not match its packaged facts.',
      );
    expect(question.verificationStatus).toBe('verified');
    expect(stages.encounters[question.id].technical?.review.verdict).toBe(
      'verified',
    );
    expect(stages.encounters[question.id].adversarial?.verdict).toBe(
      'verified',
    );
    const selected =
      index === 1
        ? question.answerChoices
            .filter((choice) => !question.correctAnswer.includes(choice.id))
            .slice(0, 1)
        : question.answerChoices.filter((choice) =>
            question.correctAnswer.includes(choice.id),
          );
    for (const choice of selected)
      await page
        .getByRole(
          question.questionType === 'multi-select' ? 'checkbox' : 'radio',
          { name: choice.text, exact: true },
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
    await page
      .locator('.question-feedback summary')
      .filter({ hasText: /other choices/ })
      .click();
    for (const explanation of Object.values(question.whyOtherAnswersAreWrong))
      await expect(
        page
          .locator('.question-feedback')
          .getByText(explanation, { exact: true }),
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
    await page.keyboard.press('Escape');
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
  expect(scoreSession(result).percentage).toBe(80);
  expect(scoreSession(result).byDungeon.map((row) => row.id)).toEqual([
    githubId,
  ]);
  const agentic = catalog.find(
    (credential) => credential.credentialId === agenticId,
  );
  if (!agentic) throw new Error('The GH-600 catalog entry is missing.');
  const agenticObjectives = read(join(packages, agenticId, 'objectives.json'));
  expect(agenticObjectives).not.toEqual(
    read(join(packages, githubId, 'objectives.json')),
  );
  await page.goto(`#/dungeons/${agenticId}`);
  const card = page.locator(`#dungeon-${agenticId}`);
  await expect(card).toBeVisible();
  expect(agentic).toMatchObject({
    isVerified: true,
    status: 'beta',
    allowBetaPlay: true,
  });
  await card.getByRole('button', { name: 'Descend', exact: true }).click();
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  await expect(page.locator('.question-panel .dungeon-origin')).toHaveAttribute(
    'data-dungeon-id',
    agenticId,
  );
  await page
    .getByRole('button', { name: 'Skip question', exact: true })
    .click();
  await page.getByRole('button', { name: 'Finish early', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Finish & score session', exact: true })
    .click();
  await page.waitForURL(/\/results\//);
  expect(
    scoreSession((await saved(page)).history[0]).byDungeon.map((row) => row.id),
  ).toEqual([agenticId]);
  expect(
    (await saved(page)).history.find((entry) => entry.id === result.id),
  ).toEqual(result);
  await page.goto('./');
  await page
    .locator('#dungeon-dp-700')
    .getByRole('button', { name: 'Descend', exact: true })
    .click();
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  await expect(page.locator('.question-panel .dungeon-origin')).toHaveAttribute(
    'data-dungeon-id',
    'dp-700',
  );
});
