/**
 * Playwright Configuration
 *
 * End-to-end testing configuration for the Skillancer platform.
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Read environment variables
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CI = process.env.CI === 'true';

/**
 * Playwright configuration for E2E tests
 */
export default defineConfig({
  // Directory containing test files
  testDir: path.join(__dirname, '../tests'),

  // Test file patterns
  testMatch: ['**/*.e2e.ts', '**/*.spec.ts'],

  // Test timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.02,
    },
  },

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: CI,

  // Retry failed tests
  retries: CI ? 2 : 0,

  // Workers for parallel execution
  workers: CI ? 2 : undefined,

  // Reporter configuration
  reporter: CI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ]
    : [['html', { open: 'on-failure' }], ['list']],

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: BASE_URL,

    // Collect trace when retrying
    trace: CI ? 'on-first-retry' : 'retain-on-failure',

    // Screenshot settings
    screenshot: 'only-on-failure',

    // Video settings
    video: CI ? 'on-first-retry' : 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Navigation timeout
    navigationTimeout: 30000,

    // Action timeout
    actionTimeout: 15000,

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  },

  // Global setup
  globalSetup: path.join(__dirname, './global-setup.ts'),

  // Global teardown
  globalTeardown: path.join(__dirname, './global-teardown.ts'),

  // Web server configuration
  webServer: CI
    ? undefined
    : {
        command: 'pnpm dev --filter=web',
        port: 3000,
        timeout: 120000,
        reuseExistingServer: true,
      },

  // Test projects for different browsers and configurations
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Desktop Chrome
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Desktop Firefox
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Desktop Safari
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile Chrome
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile Safari
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Tablet
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro 11'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Logged out tests
    {
      name: 'logged-out',
      testMatch: /.*\.anonymous\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined,
      },
    },

    // Admin tests
    {
      name: 'admin',
      testMatch: /.*\.admin\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
    },

    // Visual regression tests
    {
      name: 'visual',
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      snapshotDir: './snapshots',
    },

    // Accessibility tests
    {
      name: 'accessibility',
      testMatch: /.*\.a11y\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // API tests
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || 'http://localhost:4000',
        extraHTTPHeaders: {
          Accept: 'application/json',
        },
      },
    },
  ],
});

/**
 * Custom configuration for CI environments
 */
export const ciConfig = defineConfig({
  ...exports.default,
  workers: 4,
  retries: 3,
  use: {
    ...exports.default.use,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  reporter: [
    ['github'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
});

/**
 * Custom configuration for local development
 */
export const devConfig = defineConfig({
  ...exports.default,
  workers: undefined, // Use all available CPUs
  retries: 0,
  use: {
    ...exports.default.use,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    headless: false, // Run with browser visible
    launchOptions: {
      slowMo: 100, // Slow down actions
    },
  },
  reporter: [['html', { open: 'on-failure' }], ['list']],
});
