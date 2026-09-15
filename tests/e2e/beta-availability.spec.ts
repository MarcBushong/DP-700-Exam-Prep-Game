import { test, expect } from '@playwright/test';
import { freshData, STORAGE_KEY } from '../../src/services/storage';
import { defaultConfig, type QuizConfig } from '../../src/features/quiz/types';

const betaId = 'github-agentic-ai-developer';
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

test('GH-600 is visibly beta while both card entry points remain sealed', async ({
  page,
}) => {
  await page.goto(`./#/dungeons/${betaId}`);
  const card = page.locator(`#dungeon-${betaId}`);
  await expect(card).toBeVisible({ timeout: 30000 });
  const notice = card.getByRole('complementary', {
    name: 'GH-600 beta availability',
  });
  await expect(notice).toContainText('BETA · Gameplay unavailable');
  await expect(notice).toContainText('Objectives may change.');
  await expect(notice).toContainText('Unofficial study aid');
  await expect(
    card.getByRole('button', { name: 'Sealed', exact: true }),
  ).toBeDisabled();
  await expect(
    card.getByRole('button', { name: 'Boss Gauntlet', exact: true }),
  ).toBeDisabled();
  await expect(card).toContainText(
    '136 fully reviewed encounters remain unavailable',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const mode of modes) {
  test(`imported ${mode.runMode}/${mode.answerMode} cannot start a beta run`, async ({
    page,
  }) => {
    const data = freshData();
    data.selectedCredentialId = mode.credentialId ?? betaId;
    data.config = { ...defaultConfig, credentialId: betaId, ...mode };
    await page.addInitScript(
      ({ key, imported }) => {
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
    ).toContainText('Torchlight Run and Boss Gauntlet remain sealed.');
    await expect(
      page.getByRole('button', { name: 'Descend', exact: true }),
    ).toBeDisabled();
    await page.locator('form.setup-layout').evaluate((form) => {
      (form as HTMLFormElement).requestSubmit();
    });
    await expect(page).toHaveURL(/#\/setup$/);
    await page.goto('./#/play');
    await expect(
      page.getByRole('heading', { name: 'No expedition in progress.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).history,
        STORAGE_KEY,
      ),
    ).toEqual([]);
  });
}
