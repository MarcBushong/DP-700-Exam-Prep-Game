import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  freshData,
  savedDataSchema,
  STORAGE_KEY,
} from '../../src/services/storage';
import { defaultConfig, type QuizConfig } from '../../src/features/quiz/types';
import { questionSchema } from '../../src/features/grounding/schema';
import { scoreSession } from '../../src/features/results/scoring';

const betaId = 'github-agentic-ai-developer';
const questions = ['dp-700', betaId].flatMap((id) =>
  questionSchema
    .array()
    .parse(
      JSON.parse(
        readFileSync(
          join(process.cwd(), 'src', 'content', 'exams', id, 'questions.json'),
          'utf8',
        ),
      ),
    ),
);
const modes = [
  { runMode: 'study', answerMode: 'immediate' },
  { runMode: 'gauntlet', answerMode: 'exam' },
  { runMode: 'study', answerMode: 'exam' },
  {
    credentialId: 'dp-700',
    runMode: 'raid',
    answerMode: 'immediate',
    raidCredentialIds: ['dp-700', betaId],
  },
] satisfies Partial<QuizConfig>[];

test('GH-600 is visibly beta while both card entry points are open', async ({
  page,
}) => {
  await page.goto(`./#/dungeons/${betaId}`);
  const card = page.locator(`#dungeon-${betaId}`);
  await expect(card).toBeVisible({ timeout: 30000 });
  const notice = card.getByRole('complementary', {
    name: 'GH-600 beta availability',
  });
  await expect(notice).toContainText('BETA · Study access open');
  await expect(notice).toContainText('Objectives may change.');
  await expect(notice).toContainText('Unofficial study aid');
  await expect(
    card.getByRole('button', { name: 'Descend', exact: true }),
  ).toBeEnabled();
  await expect(
    card.getByRole('button', { name: 'Boss Gauntlet', exact: true }),
  ).toBeEnabled();
  await expect(card.locator('.encounter-count')).toContainText('136');
  await expect(card.getByText('beta', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const name of ['Descend', 'Boss Gauntlet']) {
    await card.getByRole('button', { name, exact: true }).click();
    await expect(page).toHaveURL(/#\/setup$/);
    await expect(
      page.getByRole('complementary', { name: 'GH-600 beta availability' }),
    ).toContainText('BETA · Study access open');
    await expect(
      page.getByRole('button', { name: 'Descend', exact: true }),
    ).toBeEnabled();
    await page.goto(`./#/dungeons/${betaId}`);
  }
});

for (const mode of modes) {
  test(`imported ${mode.runMode}/${mode.answerMode} completes a beta run with isolated scoring`, async ({
    page,
  }) => {
    const data = freshData();
    data.selectedCredentialId = mode.credentialId ?? betaId;
    data.config = {
      ...defaultConfig,
      credentialId: betaId,
      questionCount: 2,
      ...mode,
    };
    await page.addInitScript(
      ({ key, imported }) => {
        if (!localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(imported));
      },
      { key: STORAGE_KEY, imported: data },
    );
    await page.goto('./#/setup');
    await expect(page.locator('form.setup-layout')).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByRole('complementary', {
        name: 'GH-600 beta availability',
      }),
    ).toContainText(
      'Torchlight Run and Boss Gauntlet are open for beta study.',
    );
    await expect(
      page.getByRole('button', { name: 'Descend', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Descend', exact: true }).click();
    for (let index = 0; index < 2; index++) {
      const stem = (await page.locator('legend.question-title').innerText())
        .replace(/\s+/g, ' ')
        .trim();
      const question = questions.find(
        (entry) => entry.question.replace(/\s+/g, ' ').trim() === stem,
      );
      if (!question)
        throw new Error(
          'Rendered question is missing from its reviewed package.',
        );
      expect(question.verificationStatus).toBe('verified');
      const origin = page.locator('.question-panel .dungeon-origin');
      if ((await origin.getAttribute('data-dungeon-id')) === betaId) {
        await expect(origin).toContainText('GH-600 · BETA');
      }
      for (const choice of question.answerChoices.filter((entry) =>
        question.correctAnswer.includes(entry.id),
      )) {
        await page
          .getByRole(
            question.questionType === 'multi-select' ? 'checkbox' : 'radio',
            {
              name: choice.text,
              exact: true,
            },
          )
          .check();
      }
      await page
        .getByRole('button', { name: 'Submit answer', exact: true })
        .click();
      if (mode.answerMode === 'exam') {
        await expect(page.locator('.question-feedback')).toHaveCount(0);
        await expect(
          page.getByText(question.explanation, { exact: true }),
        ).toHaveCount(0);
      } else {
        await expect(page.locator('.question-feedback')).toContainText(
          question.explanation,
        );
      }
      await page
        .getByRole('button', {
          name: index === 1 ? 'View results' : 'Next question',
          exact: true,
        })
        .click();
    }
    await page.waitForURL(/\/results\//);
    const stored = savedDataSchema.parse(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        STORAGE_KEY,
      ),
    );
    expect(stored.history).toHaveLength(1);
    const score = scoreSession(stored.history[0]);
    expect(score.percentage).toBe(100);
    expect(score.byDungeon.map((entry) => entry.id).sort()).toEqual(
      mode.runMode === 'raid' ? ['dp-700', betaId].sort() : [betaId],
    );
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Expedition complete.' }),
    ).toBeVisible();
  });
}
