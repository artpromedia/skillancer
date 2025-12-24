/**
 * Testing Package Index
 *
 * Central export for all testing utilities.
 */

// ==================== Configuration ====================
export * from './config/jest.config.base';

// ==================== Setup ====================
export * from './setup/jest.setup';

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

// Custom types
export type { TestDatabaseOptions, TestDatabaseContext } from './fixtures/test-database';

export type { UserData, CourseData, JobData, ContractData } from './fixtures/factories';

export type {
  AuthTokens,
  APITestClientOptions,
  RequestOptions,
  APIResponse,
} from './helpers/api-test-client';
