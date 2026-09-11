import { test, expect } from '@playwright/test';

test('launches from the project URL and keeps navigation on the static host', async ({
  page,
  baseURL,
}) => {
  const failedRequests: string[] = [];
  page.on('requestfailed', (request) => failedRequests.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(response.url());
  });

  await page.goto('./');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'The Certification Dungeon',
    }),
  ).toBeVisible();
  await page
    .locator('#dungeon-dp-700')
    .getByRole('button', { name: 'Descend', exact: true })
    .click();
  await expect(page).toHaveURL(`${baseURL}#/setup`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Prepare your expedition.' }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(baseURL!);
  await page.goForward();
  await expect(page).toHaveURL(`${baseURL}#/setup`);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Descend' })).toBeVisible();
  expect(failedRequests).toEqual([]);
});

test('a missing hash route offers navigation back to the hosted app', async ({
  page,
  baseURL,
}) => {
  await page.goto('#/not-a-route');
  await expect(
    page.getByRole('heading', { level: 1, name: /^This path/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to dungeon map' }).click();
  await expect(page).toHaveURL(`${baseURL}#/`);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'The Certification Dungeon',
    }),
  ).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('explains the browser requirement', async ({ page }) => {
    await page.goto('./');
    const notice = page.locator('noscript p');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Enable JavaScript in your browser');
  });
});
