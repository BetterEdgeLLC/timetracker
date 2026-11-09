import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  workers: 1,
  outputDir: 'test-results/artifacts',
  reporter: [['list'], ['html', { outputFolder: 'test-results/report', open: 'never' }]]
})
