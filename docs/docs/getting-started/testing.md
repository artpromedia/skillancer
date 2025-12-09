---
sidebar_position: 5
---

# Testing

Skillancer uses a comprehensive testing strategy with multiple layers of tests.

## Testing Stack

| Tool                      | Purpose                  |
| ------------------------- | ------------------------ |
| **Vitest**                | Unit & integration tests |
| **React Testing Library** | Component testing        |
| **Playwright**            | End-to-end testing       |
| **MSW**                   | API mocking              |
| **Faker**                 | Test data generation     |

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @skillancer/web test
pnpm --filter @skillancer/auth-svc test

# Watch mode
pnpm test -- --watch

# With coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e
```

## Test Structure

### Unit Tests

Located next to the code they test:

```
src/
├── utils/
│   ├── format-currency.ts
│   └── format-currency.test.ts
├── components/
│   ├── button.tsx
│   └── button.test.tsx
```

### Integration Tests

Located in `__tests__` directories:

```
src/
├── services/
│   └── user.service.ts
└── __tests__/
    └── user.service.integration.test.ts
```

### E2E Tests

Located in a dedicated directory:

```
apps/web/
└── e2e/
    ├── auth.spec.ts
    ├── marketplace.spec.ts
    └── fixtures/
```

## Writing Unit Tests

### Basic Test

```typescript
// format-currency.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './format-currency';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('formats EUR correctly', () => {
    expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('handles negative numbers', () => {
    expect(formatCurrency(-100, 'USD')).toBe('-$100.00');
  });
});
```

### Testing React Components

```typescript
// button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading spinner when loading', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
```

### Testing Async Code

```typescript
// user.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './user.service';
import { prisma } from '@skillancer/database';

vi.mock('@skillancer/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('returns user when found', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await service.getById('1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('returns null when not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });
});
```

## Testing API Routes

```typescript
// routes/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app';
import type { FastifyInstance } from 'fastify';

describe('User Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users/:id', () => {
    it('returns 200 with user data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/123',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({
        id: '123',
        email: expect.any(String),
      });
    });

    it('returns 404 when user not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/nonexistent',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/123',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
```

## E2E Testing with Playwright

### Basic E2E Test

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can log in', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('[role="alert"]')).toContainText('Invalid credentials');
  });
});
```

### Page Objects

```typescript
// e2e/pages/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[name="email"]');
    this.passwordInput = page.locator('[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorAlert = page.locator('[role="alert"]');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

// Usage in test
test('user can log in', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('test@example.com', 'password123');
  await expect(page).toHaveURL('/dashboard');
});
```

## Test Utilities

### Test Factories

```typescript
// tests/factories/user.factory.ts
import { faker } from '@faker-js/faker';
import type { User } from '@skillancer/types';

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    avatar: faker.image.avatar(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

// Usage
const user = createMockUser({ email: 'specific@example.com' });
```

### Custom Matchers

```typescript
// tests/setup.ts
import { expect } from 'vitest';

expect.extend({
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid email`
          : `expected ${received} to be a valid email`,
    };
  },
});

// Usage
expect('test@example.com').toBeValidEmail();
```

## Coverage Requirements

We aim for:

| Type               | Coverage Target |
| ------------------ | --------------- |
| Unit Tests         | 80%             |
| Integration Tests  | 70%             |
| E2E Critical Paths | 100%            |

View coverage report:

```bash
pnpm test:coverage

# Opens HTML report
open coverage/index.html
```

## Continuous Integration

Tests run automatically on every PR:

```yaml
# .github/workflows/test.yml
- Unit tests (all packages)
- Integration tests
- E2E tests (on staging deploy)
```

## Best Practices

### Do's

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Keep tests independent
- ✅ Use factories for test data
- ✅ Clean up after tests

### Don'ts

- ❌ Test external services directly
- ❌ Share state between tests
- ❌ Use hard-coded IDs or data
- ❌ Write tests that depend on order

## Next Steps

- [Debugging](/docs/getting-started/debugging) - Debug your tests
- [Code Generation](/docs/getting-started/code-generation) - Generate test scaffolding
