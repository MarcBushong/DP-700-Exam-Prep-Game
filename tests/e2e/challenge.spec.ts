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
      new URL(`../../src/content/exams/dp-700/${name}.json`, import.meta.url),
      'utf8',
    ),
  );
const content = validateContent(
  readData('questions'),
  readData('sources'),
  readData('objectives'),
);

async function currentQuestion(page: Page) {
  await expect(
    page.getByRole('button', { name: 'Submit answer', exact: true }),
  ).toBeVisible();
  const text = await page.locator('legend.question-title').innerText();
  const question = content.questions.find(
    (q) =>
      text.replace(/\s+/g, ' ').trim() ===
      q.question.replace(/\s+/g, ' ').trim(),
  );
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
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
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
  await page.getByRole('button', { name: 'Descend', exact: true }).click();

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
      await page
        .getByRole('button', { name: 'Open tome · view sources' })
        .click();
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
        page.getByRole('button', { name: 'Open tome · view sources' }),
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

for (const difficulty of ['advanced', 'expert'] as const) {
  test(`${difficulty} journey reviews documentation, varied reactions, domain scores and weak practice`, async ({
    page,
  }) => {
    await configuredStart(page, {
      difficulty,
      format: 'mixed',
      answerMode: 'immediate',
      questionCount: 5,
    });
    const seen = new Set<string>();
    let previousReaction = '';
    for (let index = 0; index < 5; index++) {
      const question = await currentQuestion(page);
      expect(question.difficulty).toBe(difficulty);
      expect(question.verificationStatus).toBe('verified');
      expect(seen.has(question.id)).toBe(false);
      seen.add(question.id);
      const choices =
        index === 1
          ? [
              question.answerChoices.find(
                (choice) => !question.correctAnswer.includes(choice.id),
              )!,
            ]
          : question.answerChoices.filter((choice) =>
              question.correctAnswer.includes(choice.id),
            );
      for (const choice of choices) {
        await page
          .getByRole(
            question.questionType === 'multi-select' ? 'checkbox' : 'radio',
            { name: choice.text },
          )
          .check();
      }
      await page
        .getByRole('button', { name: 'Submit answer', exact: true })
        .click();
      const reaction = page.locator('.question-feedback [data-reaction-id]');
      await expect(reaction).toBeVisible();
      const reactionId = await reaction.getAttribute('data-reaction-id');
      expect(reactionId).not.toBe(previousReaction);
      previousReaction = reactionId!;
      await expect(
        page.getByRole('status', { name: 'Answer feedback' }),
      ).toContainText(question.explanation);
      await expect(reaction).toHaveAttribute('aria-live', 'off');
      await page
        .getByRole('button', { name: 'Open tome · view sources', exact: true })
        .click();
      const dialog = page.getByRole('dialog');
      const links = dialog.getByRole('link');
      await expect(links).toHaveCount(question.sourceUrls.length);
      for (let source = 0; source < question.sourceUrls.length; source++) {
        await expect(links.nth(source)).toHaveAttribute(
          'href',
          question.sourceUrls[source],
        );
        await expect(links.nth(source)).toHaveAttribute('target', '_blank');
      }
      await expect(dialog).toContainText('Source ID:');
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', {
          name: 'Open tome · view sources',
          exact: true,
        }),
      ).toBeFocused();
      await page
        .getByRole('button', {
          name: index === 4 ? 'View results' : 'Next question',
          exact: true,
        })
        .click();
    }
    await page.waitForURL(/\/results\//);
    const snapshot = (await saved(page)).history[0];
    const score = scoreSession(snapshot, content.taxonomy);
    expect(score.correct).toBe(4);
    expect(snapshot.questions).toHaveLength(5);
    await expect(
      page.getByRole('heading', { name: 'Your floor results' }),
    ).toBeVisible();
    for (const row of score.byDomain) {
      const card = page.locator('.domain-result').filter({
        has: page.getByRole('heading', { name: row.label, exact: true }),
      });
      await expect(card).toContainText(`${row.percentage}%`);
      await expect(card.getByRole('progressbar')).toHaveAttribute(
        'value',
        String(row.correct),
      );
    }
    await page
      .getByRole('button', { name: 'Revisit cursed chambers', exact: true })
      .click();
    await page.waitForURL(/\/play$/);
    const next = await currentQuestion(page);
    const missedSkills = snapshot.questions
      .filter((question) => {
        const response = snapshot.responses.find(
          (answer) => answer.questionId === question.id,
        );
        return (
          !response ||
          !response.selectedAnswer.length ||
          response.selectedAnswer.length !== question.correctAnswer.length ||
          response.selectedAnswer.some(
            (choice) => !question.correctAnswer.includes(choice),
          )
        );
      })
      .map((question) => question.skill);
    expect(missedSkills).toContain(next.skill);
  });
}

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
        page.getByRole('button', { name: 'Open tome · view sources' }),
      ).toBeVisible();
    if (answerMode === 'exam' || answerMode === 'hidden')
      await expect(
        page.getByRole('button', { name: 'Open tome · view sources' }),
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
        page.getByRole('button', { name: 'Open tome · view sources' }),
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
  await page.getByRole('radio', { name: /^Silent/ }).check();
  await page.reload();
  expect((await saved(page)).preferences.theme).toBe('light');
  expect((await saved(page)).preferences.banterLevel).toBe('none');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test('resetting recent questions preserves saved scores and preferences across reload', async ({
  page,
}) => {
  await page.goto('#/setup');
  await page.getByRole('radio', { name: '5', exact: true }).check();
  await page.getByRole('button', { name: 'Descend', exact: true }).click();
  await currentQuestion(page);
  await page
    .getByRole('button', { name: 'Skip question', exact: true })
    .click();
  await page.getByRole('button', { name: 'Finish early', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Finish & score session', exact: true })
    .click();
  await page.waitForURL(/\/results\//);
  await page.goto('#/settings');
  await page.getByRole('radio', { name: /^Full/ }).check();
  await page.getByRole('radio', { name: /Torch · light/ }).check();
  const before = await saved(page);
  expect(before.recentQuestionIds.length).toBeGreaterThan(0);
  await page
    .getByRole('button', { name: 'Reset question history', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reset question history', exact: true })
    .click();
  await expect(page.getByRole('status')).toHaveCount(1);
  await expect(
    page.getByRole('status', { name: 'Study notices' }),
  ).toContainText('Saved scores and preferences are unchanged.');
  await page.reload();
  const after = await saved(page);
  expect(after.recentQuestionIds).toEqual([]);
  expect(after.history).toEqual(before.history);
  expect(after.preferences).toEqual(before.preferences);
  expect(after.config).toEqual(before.config);
});
