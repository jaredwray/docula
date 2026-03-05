import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.ts',
  use: { baseURL: 'http://localhost:3000', headless: true },
  webServer: {
    command: 'node bin/docula.js serve -s ./test/fixtures/mega-page-site',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
