import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--disable-gpu', '--no-sandbox'],
    },
  },
});
