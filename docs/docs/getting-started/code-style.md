---
sidebar_position: 9
---

# Code Style

This guide covers coding conventions and style guidelines for Skillancer.

## General Principles

1. **Clarity over cleverness** - Write code that's easy to understand
2. **Consistency** - Follow existing patterns
3. **Simplicity** - Avoid unnecessary complexity
4. **Documentation** - Comment the "why", not the "what"

## TypeScript

### Naming Conventions

```typescript
// Variables and functions - camelCase
const userName = 'John';
function getUserById(id: string) {}

// Classes and types - PascalCase
class UserService {}
interface UserProfile {}
type UserId = string;

// Constants - SCREAMING_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = '/api';

// Enums - PascalCase with PascalCase members
enum UserStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

// File names - kebab-case
// user-profile.ts, format-currency.ts
```

### Type Annotations

```typescript
// Prefer interfaces for objects
interface User {
  id: string;
  email: string;
  name: string;
}

// Use type for unions/intersections
type UserRole = 'admin' | 'user' | 'guest';
type UserWithRole = User & { role: UserRole };

// Prefer explicit return types for public APIs
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Use generics when appropriate
function first<T>(items: T[]): T | undefined {
  return items[0];
}
```

### Avoid `any`

```typescript
// ❌ Bad
function processData(data: any) {}

// ✅ Good
function processData(data: unknown) {
  if (isValidData(data)) {
    // TypeScript now knows the type
  }
}

// Or use generics
function processData<T extends Record<string, unknown>>(data: T) {}
```

### Null Handling

```typescript
// Use nullish coalescing
const name = user.name ?? 'Anonymous';

// Use optional chaining
const city = user.address?.city;

// Prefer undefined over null
interface Config {
  timeout?: number; // undefined if not set
}
```

## React

### Component Structure

```tsx
// 1. Imports
import * as React from 'react';
import { cn } from '@/lib/utils';

// 2. Types
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

// 3. Component
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium',
          // Variant styles
          variant === 'primary' && 'bg-primary text-primary-foreground',
          variant === 'secondary' && 'bg-secondary text-secondary-foreground',
          // Size styles
          size === 'sm' && 'h-8 px-3 text-sm',
          size === 'md' && 'h-10 px-4',
          size === 'lg' && 'h-12 px-6 text-lg',
          className
        )}
        disabled={loading}
        {...props}
      >
        {loading && <Spinner className="mr-2" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };
```

### Hooks Rules

```typescript
// Custom hooks start with "use"
function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  // ...
  return user;
}

// Extract complex logic into hooks
function useJobSearch(filters: JobFilters) {
  const query = useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => searchJobs(filters),
  });

  return {
    jobs: query.data?.jobs ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
```

### Event Handlers

```typescript
// Name handlers with "handle" prefix
function handleSubmit(event: React.FormEvent) {
  event.preventDefault();
  // ...
}

// Or "on" for props
interface Props {
  onSubmit: (data: FormData) => void;
  onChange: (value: string) => void;
}
```

## Backend (Fastify)

### Route Handlers

```typescript
// routes/users.ts
import { userSchema } from '../schemas/user.schema.js';
import { UserService } from '../services/user.service.js';

export async function userRoutes(app: FastifyInstance) {
  const service = new UserService();

  // GET /users
  app.get('/', {
    schema: {
      tags: ['Users'],
      summary: 'List all users',
      querystring: userSchema.listQuery,
      response: {
        200: userSchema.listResponse,
      },
    },
    handler: async (request, reply) => {
      const users = await service.list(request.query);
      return users;
    },
  });

  // GET /users/:id
  app.get('/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      params: userSchema.params,
      response: {
        200: userSchema.response,
        404: userSchema.notFound,
      },
    },
    handler: async (request, reply) => {
      const user = await service.getById(request.params.id);
      if (!user) {
        return reply.notFound('User not found');
      }
      return user;
    },
  });
}
```

### Service Layer

```typescript
// services/user.service.ts
export class UserService {
  constructor(private repository = new UserRepository()) {}

  async list(query: ListQuery): Promise<PaginatedResult<User>> {
    return this.repository.findMany(query);
  }

  async getById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async create(data: CreateUser): Promise<User> {
    // Business logic here
    this.validateBusinessRules(data);
    return this.repository.create(data);
  }

  private validateBusinessRules(data: CreateUser): void {
    // Validation logic
  }
}
```

## Zod Schemas

```typescript
// schemas/user.schema.ts
import { z } from 'zod';

// Base schemas
const userBase = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

// Full schema with generated fields
const user = userBase.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Request schemas
const createUser = userBase;
const updateUser = userBase.partial();

// Export as namespace
export const userSchema = {
  create: createUser,
  update: updateUser,
  response: user,
  params: z.object({ id: z.string().uuid() }),
  listQuery: z.object({
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(10),
  }),
};

// Type exports
export type User = z.infer<typeof user>;
export type CreateUser = z.infer<typeof createUser>;
```

## Imports

### Import Order

```typescript
// 1. External packages
import { useState, useEffect } from 'react';
import { z } from 'zod';

// 2. Internal packages (@skillancer/*)
import { Button } from '@skillancer/ui';
import { logger } from '@skillancer/logger';

// 3. Relative imports
import { UserService } from '../services/user.service.js';
import { formatDate } from './utils.js';

// 4. Types (using import type)
import type { User } from '@skillancer/types';
```

### Use Type-Only Imports

```typescript
// When importing only types
import type { User, UserRole } from '@skillancer/types';

// Mixed imports
import { validateUser } from '@skillancer/types';
import type { User } from '@skillancer/types';
```

## Comments

```typescript
// Single line for brief explanations
const timeout = 5000; // 5 seconds

/**
 * Multi-line for function documentation.
 * Explain purpose, parameters, and return value.
 *
 * @param userId - The unique identifier for the user
 * @returns The user object or null if not found
 */
async function getUser(userId: string): Promise<User | null> {
  // Implementation
}

// TODO: Add caching - SKILL-123
// FIXME: Handle edge case when user is null

// Explain "why", not "what"
// ❌ Bad: Increment counter
// ✅ Good: Track retry attempts to implement exponential backoff
```

## Formatting

We use Prettier for consistent formatting. Configuration is in `prettier.config.js`:

```javascript
module.exports = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
};
```

Run formatting:

```bash
pnpm format
```

## Linting

ESLint enforces code quality. Configuration is in `.eslintrc.js`.

Run linting:

```bash
pnpm lint
pnpm lint:fix
```

## Git Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat(market): add job filtering by location
fix(auth): correct session expiration handling
docs: update API authentication guide
refactor(billing): extract payment processing logic
test(market): add job service unit tests
chore: update dependencies
```
