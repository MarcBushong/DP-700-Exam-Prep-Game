import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { validateContent } from '../../src/features/grounding/schema';
import { defaultConfig, type QuizConfig } from '../../src/features/quiz/types';
import {
  freshData,
  savedDataSchema,
  STORAGE_KEY,
} from '../../src/services/storage';
import { scoreSession } from '../../src/features/results/scoring';

const readData = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../src/data/${name}.json`, import.meta.url),
      'utf8',
    ),
  );
const content = validateContent(
  readData('questions'),
  readData('grounding-manifest'),
  readData('objectives'),
);

async function currentQuestion(page: Page) {
  await expect(
    page.getByRole('button', { name: 'Submit answer', exact: true }),
  ).toBeVisible();
  const text = await page.getByRole('main').innerText();
  const question = content.questions.find((q) => text.includes(q.question));
  if (!question)
    throw new Error('The rendered question does not match the validated bank.');
  return question;
}

async function saved(page: Page) {
  return savedDataSchema.parse(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      STORAGE_KEY,
    ),
  );
}

async function configuredStart(
  page: Page,
  overrides: Partial<QuizConfig> = {},
) {
  const data = freshData();
  data.config = {
    ...defaultConfig,
    questionCount: 5,
    format: 'single-select',
    ...overrides,
  };
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: data },
  );
  await page.goto('#/setup');
  await page
    .getByRole('button', { name: 'Begin challenge', exact: true })
    .click();
  await currentQuestion(page);
}

test('configure, answer, inspect documentation, export, review and retry missed questions', async ({
  page,
}) => {
  await page.goto('#/setup');
  await page.getByRole('radio', { name: '5', exact: true }).check();
  await page
    .getByLabel('Question format', { exact: true })
    .selectOption('single-select');
  await page
    .getByLabel('Question order', { exact: true })
    .selectOption('study-guide');
  await page
    .getByRole('button', { name: 'Begin challenge', exact: true })
    .click();

  for (let i = 0; i < 5; i++) {
    const question = await currentQuestion(page);
    const chosen = question.answerChoices.find((c) =>
      i === 1
        ? !question.correctAnswer.includes(c.id)
        : question.correctAnswer.includes(c.id),
    );
    if (!chosen) throw new Error('Missing documented choice.');
    if (i === 1)
      await page
        .getByRole('checkbox', { name: 'Flag for review', exact: true })
        .check();
    await page.getByRole('radio', { name: chosen.text, exact: false }).check();
    await page
      .getByRole('button', { name: 'Submit answer', exact: true })
      .click();
    if (i === 0) {
      await page.getByRole('button', { name: 'View sources' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('link').first()).toHaveAttribute(
        'href',
        /^https:\/\/learn\.microsoft\.com\//,
      );
      await expect(dialog.getByRole('link').first()).toHaveAttribute(
        'rel',
        /noopener/,
      );
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'View sources' }),
      ).toBeFocused();
    }
    await page
      .getByRole('button', {
        name: /^(Next question|View results|See results)$/,
      })
      .click();
  }
  await page.waitForURL(/\/results\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const snapshot = (await saved(page)).history[0];
  expect(scoreSession(snapshot, content.taxonomy)).toMatchObject({
    correct: 4,
    incorrect: 1,
    unanswered: 0,
    percentage: 80,
  });
  expect(snapshot.responses.filter((r) => r.flagged)).toHaveLength(1);
  const resultsURL = page.url();
  await page.reload();
  await expect(page).toHaveURL(resultsURL);
  await expect(
    page.getByRole('link', {
      name: /review all|review every|question review/i,
    }),
  ).toBeVisible();
  expect((await saved(page)).history[0].id).toBe(snapshot.id);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);

  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /JSON/i }).click();
  expect((await jsonDownload).suggestedFilename()).toMatch(/\.json$/);
  const htmlDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /HTML/i }).click();
  expect((await htmlDownload).suggestedFilename()).toMatch(/\.html$/);

  await page
    .getByRole('link', { name: /review all|review every|question review/i })
    .click();
  await page.waitForURL(/\/review\//);
  const reviewURL = page.url();
  await page.reload();
  await expect(page).toHaveURL(reviewURL);
  for (const question of snapshot.questions)
    await expect(
      page.getByText(question.question, { exact: true }),
    ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto(`#/results/${snapshot.id}`);
  await page.getByRole('button', { name: /^Retry missed/ }).click();
  const retried = await currentQuestion(page);
  expect(retried.id).toBe(snapshot.questions[1].id);
  await expect(
    page.getByText('Question 1 of 1', { exact: true }),
  ).toBeVisible();
});

for (const answerMode of [
  'immediate',
  'explanations-only',
  'hidden',
  'study',
  'exam',
] as const) {
  test(`honors ${answerMode} answer visibility`, async ({ page }) => {
    await configuredStart(page, { answerMode, questionCount: 1 });
    const question = await currentQuestion(page);
    if (answerMode === 'study')
      await expect(
        page.getByRole('button', { name: 'View sources' }),
      ).toBeVisible();
    if (answerMode === 'exam' || answerMode === 'hidden')
      await expect(
        page.getByRole('button', { name: 'View sources' }),
      ).toHaveCount(0);
    await page
      .getByRole('radio', {
        name: question.answerChoices.find((c) =>
          question.correctAnswer.includes(c.id),
        )!.text,
      })
      .check();
    await page
      .getByRole('button', { name: 'Submit answer', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: /^(View results|See results)$/ }),
    ).toBeVisible();
    if (answerMode === 'hidden' || answerMode === 'exam') {
      await expect(
        page.getByText(question.explanation, { exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText(/Correct answer:/)).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'View sources' }),
      ).toHaveCount(0);
      await expect(page.getByText(/current streak/)).toHaveCount(0);
    } else {
      await expect(
        page.getByText(question.explanation, { exact: true }),
      ).toBeVisible();
      if (answerMode === 'explanations-only') {
        await expect(page.getByText(/Correct answer:/)).toHaveCount(0);
        await expect(
          page.getByText('Your answer · correct', { exact: true }),
        ).toHaveCount(0);
      } else {
        await expect(page.getByText(/Correct answer:/)).toBeVisible();
      }
    }
    await page
      .getByRole('button', { name: /^(View results|See results)$/ })
      .click();
    await page.waitForURL(/\/results\//);
    expect((await saved(page)).history[0].responses[0].selectedAnswer).toEqual(
      question.correctAnswer,
    );
  });
}

test('multi-select locks only the exact chosen set', async ({ page }) => {
  await configuredStart(page, { format: 'multi-select', questionCount: 1 });
  const question = await currentQuestion(page);
  for (const choice of question.answerChoices.filter((c) =>
    question.correctAnswer.includes(c.id),
  )) {
    await page
      .getByRole('checkbox', { name: choice.text, exact: false })
      .check();
  }
  await page
    .getByRole('button', { name: 'Submit answer', exact: true })
    .click();
  await page
    .getByRole('button', { name: /^(View results|See results)$/ })
    .click();
  await page.waitForURL(/\/results\//);
  expect(
    scoreSession((await saved(page)).history[0], content.taxonomy).correct,
  ).toBe(1);
});

test('full-session timeout works across delayed background callbacks', async ({
  page,
}) => {
  await page.clock.install();
  await configuredStart(page, { timerMode: 'session', timerSeconds: 10 });
  await page.clock.fastForward(11000);
  await page.waitForURL(/\/results\//);
  const result = (await saved(page)).history[0];
  expect(scoreSession(result, content.taxonomy)).toMatchObject({
    correct: 0,
    unanswered: 5,
  });
  expect(result.responses[0].timedOut).toBe(true);
});

test('per-question timeout locks unanswered and next question receives a new clock', async ({
  page,
}) => {
  await page.clock.install();
  await configuredStart(page, { timerMode: 'question', timerSeconds: 10 });
  await page.clock.fastForward(11000);
  await expect(
    page.getByRole('button', { name: 'Next question', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Next question', exact: true })
    .click();
  await expect(
    page.getByText('Question 2 of 5', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Submit answer', exact: true }),
  ).toBeVisible();
});

test('persists setup choices and theme across reload', async ({ page }) => {
  await page.goto('#/setup');
  await page.getByLabel('Difficulty', { exact: true }).selectOption('advanced');
  await page.getByRole('radio', { name: '20', exact: true }).check();
  await page.reload();
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue(
    'advanced',
  );
  await expect(
    page.getByRole('radio', { name: '20', exact: true }),
  ).toBeChecked();
  await page.goto('#/settings');
  await page.getByRole('radio', { name: /light/i }).check();
  await page.reload();
  expect((await saved(page)).preferences.theme).toBe('light');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});
