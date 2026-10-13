import { defineConfig, devices } from '@playwright/test'

const webUrl = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: webUrl,
    ...devices['Desktop Chrome'],
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm --filter @closet/web dev --host 127.0.0.1 --port 4173 --strictPort',
    url: `${webUrl}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_URL: 'http://127.0.0.1:49999' },
  },
})
