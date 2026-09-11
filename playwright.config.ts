import { defineConfig, devices } from '@playwright/test';

const basePath = '/The-Certification-Dungeon/';
const baseURL = `http://127.0.0.1:4175${basePath}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port 4175 --strictPort --base ${basePath}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
