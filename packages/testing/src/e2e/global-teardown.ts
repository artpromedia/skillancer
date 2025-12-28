/**
 * Playwright Global Teardown
 *
 * Runs once after all tests to clean up the test environment.
 */

import fs from 'fs';
import path from 'path';

import type { FullConfig } from '@playwright/test';

/**
 * Global teardown function
 */
async function globalTeardown(_config: FullConfig) {
  console.log('\n🧹 Running global teardown...');

  // Clean up test artifacts if not in CI
  if (process.env.CI !== 'true' && process.env.KEEP_TEST_ARTIFACTS !== 'true') {
    cleanupArtifacts();
  }

  // Run any custom cleanup
  await runCustomCleanup();

  console.log('✅ Global teardown complete\n');
}

/**
 * Clean up test artifacts
 */
function cleanupArtifacts() {
  const artifactsDir = path.join(process.cwd(), 'test-results');
  const authDir = path.join(process.cwd(), 'playwright/.auth');

  // Keep auth files but clean old artifacts
  if (fs.existsSync(artifactsDir)) {
    const entries = fs.readdirSync(artifactsDir);

    for (const entry of entries) {
      const entryPath = path.join(artifactsDir, entry);
      const stats = fs.statSync(entryPath);

      // Remove files older than 7 days
      const age = Date.now() - stats.mtime.getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000;

      if (age > maxAge) {
        if (stats.isDirectory()) {
          fs.rmSync(entryPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(entryPath);
        }
        console.log(`🗑️ Removed old artifact: ${entry}`);
      }
    }
  }

  // Clean expired auth states
  if (fs.existsSync(authDir)) {
    const authFiles = fs.readdirSync(authDir);

    for (const file of authFiles) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(authDir, file);
      const stats = fs.statSync(filePath);
      const age = Date.now() - stats.mtime.getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Removed expired auth: ${file}`);
      }
    }
  }
}

/**
 * Run any custom cleanup operations
 */
async function runCustomCleanup() {
  // Add custom cleanup logic here
  // For example: reset test database, clear test caches, etc.

  // If using test database
  if (process.env.CLEANUP_TEST_DB === 'true') {
    console.log('🗄️ Cleaning up test database...');
    // await cleanupTestDatabase();
  }

  // If using test storage
  if (process.env.CLEANUP_TEST_STORAGE === 'true') {
    console.log('📦 Cleaning up test storage...');
    // await cleanupTestStorage();
  }
}

export default globalTeardown;
