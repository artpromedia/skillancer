# @skillancer/testing

Comprehensive testing utilities for the Skillancer monorepo. This package provides shared testing configurations, utilities, fixtures, and helpers for Jest, Playwright, and k6 performance testing.

## Installation

```bash
pnpm add -D @skillancer/testing
```

## Features

- **Jest Configuration**: Shared base configurations for unit, integration, component, and API tests
- **Test Fixtures**: Factory pattern for generating test data with Faker.js
- **Database Utilities**: Schema isolation for parallel test execution
- **API Test Client**: Authenticated API testing with supertest
- **E2E Page Objects**: Playwright page object models for UI testing
- **Performance Tests**: k6 load, stress, and spike testing configurations
- **Custom Matchers**: Extended Jest matchers for common assertions

## Usage

### Jest Configuration

```typescript
// jest.config.ts
import { createUnitTestConfig } from '@skillancer/testing';

export default createUnitTestConfig({
  // Additional overrides
  collectCoverageFrom: ['src/**/*.ts'],
});
```

### Test Factories

```typescript
import { userFactory, courseFactory, jobFactory } from '@skillancer/testing';

// Create a single user
const user = userFactory().trait('verified', 'instructor').build();

// Create multiple jobs
const jobs = jobFactory().trait('open').buildMany(10);

// Create with overrides
const admin = userFactory().with({ email: 'admin@example.com' }).trait('admin').build();
```

### Database Testing

```typescript
import { TestDatabase } from '@skillancer/testing';

describe('User Repository', () => {
  const testDb = new TestDatabase();

  beforeAll(async () => {
    await testDb.setup();
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  afterEach(async () => {
    await testDb.clean();
  });

  it('should create a user', async () => {
    const user = await testDb.prisma.user.create({
      data: { email: 'test@example.com' },
    });
    expect(user.id).toBeDefined();
  });
});
```

### API Testing

```typescript
import { createAPITestClient, assertSuccess } from '@skillancer/testing';
import { app } from '../app';

describe('User API', () => {
  const client = createAPITestClient(app);

  beforeAll(async () => {
    await client.login({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should get user profile', async () => {
    const response = await client.get('/api/v1/users/me');
    assertSuccess(response);
    expect(response.body.data.email).toBe('test@example.com');
  });
});
```

### E2E Testing with Playwright

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage, DashboardPage } from '@skillancer/testing';

test('user can login and view dashboard', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndExpectSuccess('user@example.com', 'password');

  const dashboard = new DashboardPage(page);
  await expect(dashboard.header).toBeVisible();
});
```

### Performance Testing with k6

```bash
# Run load test
k6 run packages/testing/src/performance/k6/load-test.js

# Run with custom options
k6 run --vus 50 --duration 5m packages/testing/src/performance/k6/api-test.js
```

## Custom Jest Matchers

```typescript
// Check if number is within range
expect(value).toBeWithinRange(1, 10);

// Check API response
expect(response).toMatchAPIResponse({ status: 200, body: { success: true } });

// Check UUID format
expect(id).toBeUUID();

// Check ISO date format
expect(timestamp).toBeISODate();

// Check response time
expect(responseTime).toRespondWithin(500);
```

## Test Utilities

```typescript
import { wait, waitFor, retry, measureTime, benchmark } from '@skillancer/testing';

// Wait for condition
await waitFor(() => element.isVisible());

// Retry with backoff
const result = await retry(async () => fetchData(), {
  maxRetries: 3,
  delay: 1000,
  backoff: 'exponential',
});

// Measure execution time
const { result, durationMs } = await measureTime(async () => performAction());

// Benchmark a function
const stats = await benchmark(async () => processData(), 100);
console.log(`p95: ${stats.p95}ms, mean: ${stats.mean}ms`);
```

## Configuration Files

### Available Configurations

| Config                          | Description                            |
| ------------------------------- | -------------------------------------- |
| `baseConfig`                    | Shared base configuration              |
| `createUnitTestConfig()`        | Unit test configuration                |
| `createIntegrationTestConfig()` | Integration test with extended timeout |
| `createComponentTestConfig()`   | React component testing with jsdom     |
| `createApiTestConfig()`         | API testing configuration              |

## Directory Structure

```
src/
├── config/
│   └── jest.config.base.ts    # Jest configurations
├── setup/
│   ├── jest.setup.ts          # Global Jest setup
│   ├── react.setup.ts         # React/Testing Library setup
│   └── api.setup.ts           # API testing setup with MSW
├── fixtures/
│   ├── test-database.ts       # Database utilities
│   └── factories.ts           # Data factories
├── helpers/
│   ├── api-test-client.ts     # API test client
│   └── utils.ts               # General utilities
├── e2e/
│   ├── playwright.config.ts   # Playwright configuration
│   ├── global-setup.ts        # Global E2E setup
│   ├── global-teardown.ts     # Global E2E teardown
│   └── page-objects.ts        # Page object models
└── performance/
    └── k6/
        ├── load-test.js       # Load testing
        └── api-test.js        # API performance tests
```

## Environment Variables

| Variable          | Description                   | Default                 |
| ----------------- | ----------------------------- | ----------------------- |
| `DATABASE_URL`    | Test database connection      | -                       |
| `BASE_URL`        | Base URL for E2E tests        | `http://localhost:3000` |
| `API_URL`         | API URL for performance tests | `http://localhost:4000` |
| `DEBUG_PRISMA`    | Enable Prisma query logging   | `false`                 |
| `SKIP_AUTH_SETUP` | Skip E2E auth setup           | `false`                 |

## Contributing

When adding new testing utilities:

1. Export from `src/index.ts`
2. Add documentation to this README
3. Include usage examples
4. Add type definitions for TypeScript support
