/**
 * Testing Package Index
 *
 * Central export for all testing utilities.
 */

// ==================== Configuration ====================
export * from './config/jest.config.base';

// ==================== Setup ====================
// jest.setup is a side-effect only module, just import it
import './setup/jest.setup';

// ==================== Fixtures ====================
export * from './fixtures/test-database';
export * from './fixtures/factories';

// ==================== Helpers ====================
export * from './helpers/api-test-client';
export * from './helpers/utils';

// ==================== E2E ====================
export * from './e2e/page-objects';

// ==================== Re-exports for convenience ====================

// Testing libraries
export { faker } from '@faker-js/faker';
export type { Page, Locator, BrowserContext } from '@playwright/test';
