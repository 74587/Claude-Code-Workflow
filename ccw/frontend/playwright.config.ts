import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    // E2E runs the Vite dev server with a root base to keep route URLs stable in tests.
    // (Many tests use absolute paths like `/sessions` which should resolve to the app router.)
    baseURL: 'http://localhost:5173/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/',
    env: {
      ...process.env,
      VITE_BASE_URL: '/',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
