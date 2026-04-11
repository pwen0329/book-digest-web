import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/components/**/*.test.ts?(x)'],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  // Start a local app automatically unless an external BASE_URL is provided.
  // Playwright now uses local Supabase for testing - configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables to point to your local instance.
  webServer: process.env.BASE_URL ? undefined : process.env.CI ? {
    command: 'rm -rf .local/uploads/admin .local/playwright-email-outbox.json && ALLOW_CAPACITY_RESET=1 ADMIN_PASSWORD=test-admin ADMIN_SESSION_SECRET=test-session EMAIL_OUTBOX_FILE=.local/playwright-email-outbox.json NEXT_DIST_DIR=.next-ci npm run start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 120 * 1000,
  } : {
    command: 'rm -rf .local/uploads/admin .local/playwright-email-outbox.json && ALLOW_CAPACITY_RESET=1 ADMIN_PASSWORD=test-admin ADMIN_SESSION_SECRET=test-session EMAIL_OUTBOX_FILE=.local/playwright-email-outbox.json NEXT_DIST_DIR=.next-e2e npx next dev -H 127.0.0.1 -p 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});