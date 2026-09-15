import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  questionSchema,
  taxonomySchema,
} from '../../src/features/grounding/schema';
import { validationMetadataSchema } from '../../src/features/dungeons/threePass';
import { credentialSchema } from '../../src/features/dungeons/schema';
import { objectiveFingerprint } from '../../src/features/dungeons/review';
import { scoreSession } from '../../src/features/results/scoring';
import {
  defaultConfig,
  sessionResultSchema,
} from '../../src/features/quiz/types';
import {
  addResult,
  freshData,
  savedDataSchema,
  STORAGE_KEY,
} from '../../src/services/storage';

const root = join(process.cwd(), 'src', 'content', 'exams');
const read = (id: string, name: string): unknown =>
  JSON.parse(readFileSync(join(root, id, `${name}.json`), 'utf8'));

async function saved(page: Page) {
  return savedDataSchema.parse(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      STORAGE_KEY,
    ),
  );
}

test('AI availability gates protect reviewed content and preserve isolated historical progress', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(60000);
  const remoteRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin)
      remoteRequests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const catalog = credentialSchema
    .array()
    .parse(
      JSON.parse(
        readFileSync(
          join(root, '..', 'credentials', 'credentials.json'),
          'utf8',
        ),
      ),
    );
  const legacyRoot = join(root, 'ai-103', 'history', 'pre-three-pass');
  const legacyQuestion = questionSchema
    .array()
    .parse(
      JSON.parse(readFileSync(join(legacyRoot, 'questions.json'), 'utf8')),
    )[0];
  const legacyObjectives = taxonomySchema.parse(
    JSON.parse(readFileSync(join(legacyRoot, 'objectives.json'), 'utf8')),
  );
  const now = new Date().toISOString();
  // A synthetic completed run of the genuine archived question tests history, not new eligibility.
  const historical = sessionResultSchema.parse({
    id: 'ai103-legacy-history-fixture',
    credentialId: 'ai-103',
    startedAt: now,
    completedAt: now,
    groundedAt: legacyObjectives.retrievedAt,
    config: { ...defaultConfig, credentialId: 'ai-103', questionCount: 1 },
    questions: [legacyQuestion],
    responses: [
      {
        questionId: legacyQuestion.id,
        selectedAnswer: legacyQuestion.correctAnswer,
        timeMs: 10,
        flagged: false,
        submittedAt: now,
        timedOut: false,
      },
    ],
    questionOrigins: {
      [legacyQuestion.id]: {
        credentialId: 'ai-103',
        objectiveVersion: legacyObjectives.studyGuideEffectiveDate,
      },
    },
    objectiveSnapshots: { 'ai-103': legacyObjectives },
  });
  const completed = [historical];
  await page.addInitScript(
    ({ key, data }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(data));
    },
    {
      key: STORAGE_KEY,
      data: addResult(freshData(), historical),
    },
  );
  await page.goto('./');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 30000 });
  for (const id of ['ai-103', 'ai-200']) {
    const questions = questionSchema.array().parse(read(id, 'questions'));
    const taxonomy = taxonomySchema.parse(read(id, 'objectives'));
    const stages = validationMetadataSchema.parse(
      read(id, 'validation-metadata'),
    );
    const credential = catalog.find((entry) => entry.credentialId === id);
    if (!credential) throw new Error(`Missing ${id} catalog identity.`);
    await page.goto('./');
    await expect(page.locator(`#dungeon-${id}`)).toBeVisible({
      timeout: 30000,
    });
    if (!credential.isVerified || credential.status !== 'active') {
      const card = page.locator(`#dungeon-${id}`);
      await expect(
        card.getByRole('button', { name: 'Sealed', exact: true }),
      ).toBeDisabled();
      await expect(
        card.getByRole('button', { name: 'Boss Gauntlet', exact: true }),
      ).toBeDisabled();
      for (const runMode of ['study', 'gauntlet'] as const) {
        await page.goto('#/setup');
        await expect(page.locator('form.setup-layout')).toBeVisible({
          timeout: 30000,
        });
        const before = await saved(page);
        await page.evaluate(
          ({ key, data, id, config }) => {
            localStorage.setItem(
              key,
              JSON.stringify({
                ...data,
                selectedCredentialId: id,
                config,
              }),
            );
          },
          {
            key: STORAGE_KEY,
            data: before,
            id,
            config: { ...defaultConfig, credentialId: id, runMode },
          },
        );
        await page.reload();
        await expect(page.locator('form.setup-layout')).toBeVisible({
          timeout: 30000,
        });
        await expect(
          page.getByText('This expedition is sealed.', { exact: false }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Descend', exact: true }),
        ).toBeDisabled();
        const after = await saved(page);
        expect(after.history).toEqual(before.history);
        expect(
          after.history.find((result) => result.id === historical.id),
        ).toEqual(historical);
        expect(scoreSession(historical).byDungeon.map((row) => row.id)).toEqual(
          ['ai-103'],
        );
      }
      continue;
    }
    const descend = page.locator(`#dungeon-${id}`).getByRole('button', {
      name: 'Descend',
      exact: true,
    });
    await descend.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('radio', { name: '5', exact: true }).check();
    const start = page.getByRole('button', { name: 'Descend', exact: true });
    await start.focus();
    await page.keyboard.press('Enter');
    for (let index = 0; index < 5; index++) {
      await expect(
        page.locator('.question-panel .dungeon-origin'),
      ).toHaveAttribute('data-dungeon-id', id);
      const stem = (await page.locator('legend.question-title').innerText())
        .replace(/\s+/g, ' ')
        .trim();
      const question = questions.find(
        (item) => item.question.replace(/\s+/g, ' ').trim() === stem,
      );
      if (!question) throw new Error(`Visible encounter is not in ${id}.`);
      expect(question.verificationStatus).toBe('verified');
      expect(stages.encounters[question.id].technical?.review.verdict).toBe(
        'verified',
      );
      expect(stages.encounters[question.id].adversarial?.verdict).toBe(
        'verified',
      );
      await expect(page.locator('.question-feedback')).toHaveCount(0);
      if (index === 0)
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
      const choices = question.answerChoices.filter((choice) =>
        question.correctAnswer.includes(choice.id),
      );
      for (const choice of choices)
        await page
          .getByRole(
            question.questionType === 'multi-select' ? 'checkbox' : 'radio',
            { name: choice.text, exact: true },
          )
          .check();
      const submit = page.getByRole('button', {
        name: 'Submit answer',
        exact: true,
      });
      await submit.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.locator('.question-feedback').getByText(question.explanation, {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .locator('.question-feedback summary')
        .filter({ hasText: /other choices/ })
        .click();
      for (const reason of Object.values(question.whyOtherAnswersAreWrong))
        await expect(
          page.locator('.question-feedback').getByText(reason, { exact: true }),
        ).toBeVisible();
      const tomeButton = page.getByRole('button', {
        name: 'Open tome · view sources',
        exact: true,
      });
      await tomeButton.focus();
      await page.keyboard.press('Enter');
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
      await expect(tomeButton).toBeFocused();
      await page
        .getByRole('button', {
          name: index === 4 ? 'View results' : 'Next question',
          exact: true,
        })
        .click();
    }
    await page.waitForURL(/\/results\//);
    const state = await saved(page);
    const result = state.history[0];
    expect(scoreSession(result).percentage).toBe(100);
    expect(scoreSession(result).byDungeon.map((row) => row.id)).toEqual([id]);
    expect(
      Object.values(result.questionOrigins ?? {}).map(
        (origin) => origin.credentialId,
      ),
    ).toEqual(Array(5).fill(id));
    expect(objectiveFingerprint(result.objectiveSnapshots![id])).toBe(
      objectiveFingerprint(taxonomy),
    );
    for (const previous of completed)
      expect(state.history.find((entry) => entry.id === previous.id)).toEqual(
        previous,
      );
    completed.push(result);
    await page.reload();
    expect((await saved(page)).history[0]).toEqual(result);
  }
  expect(remoteRequests).toEqual([]);
});
