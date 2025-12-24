/**
 * Jest Base Configuration
 *
 * Shared Jest configuration for all Skillancer packages and applications.
 * Provides consistent testing setup across the monorepo.
 */

import type { Config } from 'jest';

/**
 * Base configuration shared by all test types
 */
export const baseConfig: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: process.cwd(),

  // Module resolution
  moduleNameMapper: {
    '^@skillancer/(.*)$': '<rootDir>/../../packages/$1/src',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Transform
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
      },
    ],
  },

  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: '<rootDir>/coverage',

  // Test patterns
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/', '/.turbo/', '/.next/'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/../../packages/testing/src/setup/jest.setup.ts'],

  // Timeouts
  testTimeout: 30000,

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],

  // Performance
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
};

/**
 * Create unit test configuration
 */
export function createUnitTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...baseConfig,
    displayName: 'unit',
    testMatch: ['**/__tests__/unit/**/*.test.{ts,tsx}', '**/*.unit.test.{ts,tsx}'],
    ...overrides,
  };
}

/**
 * Create integration test configuration
 */
export function createIntegrationTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...baseConfig,
    displayName: 'integration',
    testMatch: ['**/__tests__/integration/**/*.test.{ts,tsx}', '**/*.integration.test.{ts,tsx}'],
    testTimeout: 60000,
    maxWorkers: 2, // Limit parallelism for integration tests
    ...overrides,
  };
}

/**
 * Create React component test configuration
 */
export function createComponentTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...baseConfig,
    displayName: 'components',
    testEnvironment: 'jsdom',
    testMatch: ['**/__tests__/components/**/*.test.{ts,tsx}', '**/*.component.test.{ts,tsx}'],
    setupFilesAfterEnv: [
      '<rootDir>/../../packages/testing/src/setup/jest.setup.ts',
      '<rootDir>/../../packages/testing/src/setup/react.setup.ts',
    ],
    moduleNameMapper: {
      ...baseConfig.moduleNameMapper,
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/../../packages/testing/src/mocks/fileMock.ts',
    },
    ...overrides,
  };
}

/**
 * Create API test configuration
 */
export function createApiTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...baseConfig,
    displayName: 'api',
    testMatch: ['**/__tests__/api/**/*.test.{ts,tsx}', '**/*.api.test.{ts,tsx}'],
    testTimeout: 45000,
    setupFilesAfterEnv: [
      '<rootDir>/../../packages/testing/src/setup/jest.setup.ts',
      '<rootDir>/../../packages/testing/src/setup/api.setup.ts',
    ],
    ...overrides,
  };
}

export default baseConfig;
