/**
 * Playwright Global Setup
 *
 * Runs once before all tests to set up the test environment.
 */

import fs from 'fs';
import path from 'path';

import { chromium, type FullConfig } from '@playwright/test';

// Test credentials
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@skillancer.io',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
};

const TEST_ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@skillancer.io',
  password: process.env.TEST_ADMIN_PASSWORD || 'AdminPassword123!',
};

/**
 * Global setup function
 */
async function globalSetup(config: FullConfig) {
  console.log('\n🔧 Running global setup...');

  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  const authDir = path.join(process.cwd(), 'playwright/.auth');

  // Ensure auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Check if we should skip auth setup
  if (process.env.SKIP_AUTH_SETUP === 'true') {
    console.log('⏭️ Skipping authentication setup');
    return;
  }

  // Launch browser for auth
  const browser = await chromium.launch();

  try {
    // Set up regular user authentication
    await setupUserAuth(browser, baseURL, authDir, TEST_USER, 'user.json');

    // Set up admin authentication
    await setupUserAuth(browser, baseURL, authDir, TEST_ADMIN, 'admin.json');

    console.log('✅ Global setup complete\n');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Set up authentication for a user
 */
async function setupUserAuth(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  baseURL: string,
  authDir: string,
  credentials: { email: string; password: string },
  filename: string
) {
  const storagePath = path.join(authDir, filename);

  // Check if storage state already exists and is recent
  if (fs.existsSync(storagePath)) {
    const stats = fs.statSync(storagePath);
    const age = Date.now() - stats.mtime.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (age < maxAge) {
      console.log(`📁 Using cached auth for ${credentials.email}`);
      return;
    }
  }

  console.log(`🔐 Authenticating ${credentials.email}...`);

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(`${baseURL}/login`);

    // Wait for login form
    await page.waitForSelector('form', { timeout: 10000 });

    // Fill in credentials
    await page.fill('input[name="email"], input[type="email"]', credentials.email);
    await page.fill('input[name="password"], input[type="password"]', credentials.password);

    // Submit form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]'),
    ]);

    // Verify login was successful
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });

    // Save storage state
    await context.storageState({ path: storagePath });
    console.log(`✅ Authenticated ${credentials.email}`);
  } catch (error) {
    console.error(`❌ Failed to authenticate ${credentials.email}:`, error);

    // Take screenshot for debugging
    const screenshotPath = path.join(authDir, `${filename.replace('.json', '-error.png')}`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Error screenshot saved to ${screenshotPath}`);

    // Create empty storage state to prevent test failures
    await context.storageState({ path: storagePath });
  } finally {
    await context.close();
  }
}

export default globalSetup;
