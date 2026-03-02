// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    baseURL: 'http://localhost:3847',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
