# Contributing to Skillancer

Thank you for your interest in contributing to Skillancer! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Commit Messages](#commit-messages)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0 (install with `npm install -g pnpm`)
- **Docker** and **Docker Compose**
- **Git**

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/skillancer.git
cd skillancer

# Run the setup script
./scripts/setup.sh

# Start development servers
pnpm dev
# or
make dev
```

The setup script will:

1. ✅ Check prerequisites
2. ✅ Install dependencies
3. ✅ Set up environment files
4. ✅ Start Docker services (PostgreSQL, Redis, LocalStack, Mailhog)
5. ✅ Run database migrations
6. ✅ Seed sample data
7. ✅ Build packages

**New developers should be up and running within 30 minutes!**

## Development Setup

### Environment Configuration

After running setup, you'll have a `.env` file in the root. Key configuration:

| Variable           | Default                                                                | Description           |
| ------------------ | ---------------------------------------------------------------------- | --------------------- |
| `DATABASE_URL`     | `postgresql://skillancer:skillancer_dev@localhost:5432/skillancer_dev` | PostgreSQL connection |
| `REDIS_URL`        | `redis://localhost:6379`                                               | Redis connection      |
| `JWT_SECRET`       | `change-this-in-production`                                            | JWT signing secret    |
| `AWS_ENDPOINT_URL` | `http://localhost:4566`                                                | LocalStack endpoint   |

### Service URLs

| Service         | URL                        | Description               |
| --------------- | -------------------------- | ------------------------- |
| Web App         | http://localhost:3000      | Next.js frontend          |
| API Gateway     | http://localhost:3001      | Main API entry point      |
| API Docs        | http://localhost:3001/docs | Swagger documentation     |
| Mailhog         | http://localhost:8025      | Email testing UI          |
| pgAdmin         | http://localhost:5050      | Database admin (optional) |
| Redis Commander | http://localhost:8081      | Redis admin (optional)    |
| LocalStack      | http://localhost:4566      | AWS services emulator     |

### Starting Optional Tools

```bash
# Start with pgAdmin and Redis Commander
make docker-tools
# or
./scripts/dev.sh --with-tools
```

## Project Structure

```
skillancer/
├── apps/                    # Frontend applications
│   ├── web/                 # Main Next.js web app
│   └── admin/               # Admin dashboard (if applicable)
│
├── services/                # Backend microservices
│   ├── api-gateway/         # API gateway & routing
│   ├── user-service/        # User management
│   ├── project-service/     # Projects & gigs
│   ├── payment-service/     # Payments & billing
│   └── notification-service/# Email, push, SMS
│
├── packages/                # Shared packages
│   ├── config/              # Shared configuration
│   ├── database/            # Prisma schema & client
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Utility functions
│   ├── ui/                  # Shared UI components
│   ├── queue/               # BullMQ queue utilities
│   ├── error-tracking/      # Sentry integration
│   └── alerting/            # PagerDuty integration
│
├── infrastructure/          # Infrastructure configs
│   ├── docker/              # Docker Compose files
│   └── terraform/           # Infrastructure as code
│
├── scripts/                 # Development scripts
│   ├── setup.sh             # Initial setup
│   ├── dev.sh               # Start dev servers
│   ├── clean.sh             # Cleanup script
│   └── reset-db.sh          # Database reset
│
└── docs/                    # Documentation
```

## Development Workflow

### Running Services

```bash
# Start all services
pnpm dev

# Start specific service
pnpm dev --filter=web
pnpm dev --filter=api-gateway
pnpm dev --filter='api-*'    # All API services

# Using make
make dev              # All services
make dev-web          # Web app only
make dev-api          # API services only
```

### Common Commands

```bash
# Dependencies
pnpm install          # Install all dependencies
pnpm add <pkg>        # Add dependency to root
pnpm add <pkg> --filter=web  # Add to specific package

# Building
pnpm build            # Build all
pnpm build --filter=web      # Build specific

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage

# Code quality
pnpm lint             # Lint all
pnpm lint --fix       # Fix issues
pnpm format           # Format code

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:migrate:dev   # Run migrations
pnpm db:seed          # Seed data
pnpm db:studio        # Open Prisma Studio
make db-reset         # Reset database
```

### VS Code Debugging

Use the provided launch configurations in `.vscode/launch.json`:

1. Click the **Run and Debug** icon (or `Ctrl+Shift+D`)
2. Select a configuration from the dropdown
3. Press `F5` to start debugging

Available configurations:

- 🌐 Web App (Next.js)
- 🔌 API Gateway
- 🚀 All Services
- 🧪 Jest: Current File
- 🔥 Full Stack (Web + API)

## Code Style

### TypeScript

- Use strict TypeScript (`"strict": true`)
- Prefer `type` over `interface` for simple types
- Use explicit return types for public functions
- Avoid `any` - use `unknown` if needed

```typescript
// ✅ Good
export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Avoid
export function calculateTotal(items: any): any {
  return items.reduce((sum: any, item: any) => sum + item.price, 0);
}
```

### File Naming

- **Components**: PascalCase (`UserProfile.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Types/Interfaces**: PascalCase (`User.ts`)
- **Constants**: SCREAMING_SNAKE_CASE in files
- **Tests**: `*.test.ts` or `*.spec.ts`

### Imports Order

1. Node.js built-in modules
2. External dependencies
3. Internal packages (`@skillancer/*`)
4. Relative imports

```typescript
import { join } from 'path';

import express from 'express';
import { z } from 'zod';

import { db } from '@skillancer/database';
import { logger } from '@skillancer/utils';

import { UserService } from './services/user.service';
import { config } from '../config';
```

## Testing

### Test Structure

```
__tests__/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/            # End-to-end tests
```

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm test --filter=@skillancer/utils

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      const result = await service.createUser({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.email).toBe('test@example.com');
      expect(result.id).toBeDefined();
    });

    it('should throw for invalid email', async () => {
      await expect(service.createUser({ email: 'invalid', name: 'Test' })).rejects.toThrow(
        'Invalid email'
      );
    });
  });
});
```

## Pull Request Process

### Before Submitting

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guide

3. **Write/update tests** for your changes

4. **Run checks locally**

   ```bash
   make ci  # Runs lint, typecheck, and tests
   ```

5. **Update documentation** if needed

### PR Guidelines

- **Title**: Use a clear, descriptive title
- **Description**: Explain what, why, and how
- **Link issues**: Reference related issues with `Fixes #123`
- **Screenshots**: Include for UI changes
- **Breaking changes**: Clearly document any breaking changes

### Review Process

1. At least one approval required
2. All CI checks must pass
3. No merge conflicts
4. Squash and merge preferred

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples

```bash
feat(auth): add social login with Google OAuth
fix(payments): handle Stripe webhook retry correctly
docs(readme): update installation instructions
refactor(api): extract validation middleware
test(users): add integration tests for user creation
chore(deps): update dependencies to latest versions
```

## Troubleshooting

### Common Issues

#### Docker services not starting

```bash
# Check if ports are in use
docker ps -a

# Stop all containers
make docker-clean

# Restart
make docker-up
```

#### Database connection issues

```bash
# Check PostgreSQL is running
docker exec -it skillancer_postgres pg_isready

# Reset database
make db-reset
```

#### Prisma issues

```bash
# Regenerate client
pnpm db:generate

# If schema drift
pnpm db:push
```

#### Node modules issues

```bash
# Clean reinstall
make clean-node
pnpm install
```

#### Port already in use

```bash
# Find process on port (e.g., 3000)
# Windows
netstat -ano | findstr :3000
# Mac/Linux
lsof -i :3000

# Kill process
# Windows
taskkill /PID <pid> /F
# Mac/Linux
kill -9 <pid>
```

### Getting Help

- 📖 Check the [documentation](./docs)
- 💬 Ask in the team Slack channel
- 🐛 Open an issue for bugs
- 💡 Open a discussion for feature ideas

---

Thank you for contributing! 🎉
