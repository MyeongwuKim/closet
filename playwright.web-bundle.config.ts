import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/web-bundle',
  use: { ...devices['Desktop Chrome'], serviceWorkers: 'block' },
  reporter: 'list',
  outputDir: 'test-results/web-bundle',
})
