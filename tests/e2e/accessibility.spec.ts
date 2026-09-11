import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const route of [
  '/',
  '/setup',
  '/settings',
  '/about',
  '/tavern',
  '/forge',
]) {
  test(`accessible local-only ${route} page`, async ({ page, baseURL }) => {
    const errors: string[] = [];
    const remoteRequests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== new URL(baseURL!).origin)
        remoteRequests.push(request.url());
    });
    const response = await page.goto(route === '/' ? './' : `#${route}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const heading = await page.getByRole('heading', { level: 1 }).innerText();
    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    expect(new URL(page.url()).pathname).toBe(new URL(baseURL!).pathname);
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(remoteRequests).toEqual([]);
  });
}

for (const route of [
  '/',
  '/setup',
  '/settings',
  '/about',
  '/tavern',
  '/forge',
]) {
  test(`keyboard skip preserves ${route} with forced colors and reduced motion`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: 'reduce',
      forcedColors: 'active',
    });
    await page.goto(`#${route}`);
    await expect(page.getByRole('main')).toBeVisible();
    const url = page.url();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /skip/i });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    await expect(page).toHaveURL(url);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze())
        .violations,
    ).toEqual([]);
  });
}
