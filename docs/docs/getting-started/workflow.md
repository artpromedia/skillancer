---
sidebar_position: 4
---

# Development Workflow

This guide covers our development practices, from feature development to deployment.

## Branching Strategy

We use a simplified Git Flow approach:

```
main (production)
  │
  ├── staging (pre-production testing)
  │     │
  │     └── feature/SKILL-123-feature-name
  │     └── fix/SKILL-456-bug-description
  │     └── chore/update-dependencies
```

### Branch Naming

| Type    | Pattern                         | Example                              |
| ------- | ------------------------------- | ------------------------------------ |
| Feature | `feature/SKILL-XXX-description` | `feature/SKILL-123-add-user-profile` |
| Bug Fix | `fix/SKILL-XXX-description`     | `fix/SKILL-456-login-redirect`       |
| Hotfix  | `hotfix/SKILL-XXX-description`  | `hotfix/SKILL-789-payment-error`     |
| Chore   | `chore/description`             | `chore/update-dependencies`          |
| Docs    | `docs/description`              | `docs/api-reference`                 |

## Development Cycle

### 1. Start a Feature

```bash
# Ensure you're up to date
git checkout staging
git pull origin staging

# Create your feature branch
git checkout -b feature/SKILL-123-add-user-profile

# Start development servers
make dev
```

### 2. Make Changes

- Write code following our [code style guide](/docs/getting-started/code-style)
- Add tests for new functionality
- Update documentation if needed

### 3. Commit Often

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Types: feat, fix, docs, style, refactor, test, chore
git commit -m "feat(auth): add password reset flow"
git commit -m "fix(market): correct bid calculation"
git commit -m "docs: update API reference"
```

Commit message format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Examples:

```bash
feat(market): add job search filters

- Add location filter
- Add skill filter
- Add salary range filter

Closes SKILL-123
```

### 4. Run Checks Locally

Before pushing, run all checks:

```bash
# Run all checks
make check

# Or individually:
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm test          # Unit tests
pnpm test:e2e      # E2E tests (if applicable)
```

### 5. Push and Create PR

```bash
git push origin feature/SKILL-123-add-user-profile
```

Then create a Pull Request on GitHub targeting `staging`.

## Pull Request Process

### PR Template

Every PR should include:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.log or debug code
```

### Code Review

- At least 1 approval required
- All CI checks must pass
- Address review comments promptly
- Squash commits if requested

### Merge Strategy

- **Squash and merge** for feature branches
- **Merge commit** for release branches
- Delete branch after merge

## CI/CD Pipeline

### Pull Request Checks

On every PR, GitHub Actions runs:

1. **Lint** - ESLint across all workspaces
2. **Type Check** - TypeScript compilation
3. **Unit Tests** - Vitest for all packages
4. **Build** - Verify all packages build
5. **E2E Tests** - Playwright for critical paths

### Deployment Pipeline

```
PR Merged to staging
        │
        ▼
   Build Docker Images
        │
        ▼
   Deploy to Staging
        │
        ▼
   Run E2E Tests
        │
        ▼
   Manual QA Approval
        │
        ▼
   Merge to main
        │
        ▼
   Deploy to Production
```

## Environment Management

### Local Development

```bash
make dev  # Starts all services
```

Uses Docker Compose for:

- PostgreSQL
- Redis
- LocalStack (AWS services)
- Mailhog (email testing)

### Staging

- Automatic deployment on `staging` branch
- Uses staging database (isolated from prod)
- Feature flags enabled for testing

### Production

- Requires manual approval
- Blue-green deployment
- Automatic rollback on health check failure

## Useful Commands

### Development

```bash
# Start development
make dev                 # All services
pnpm --filter web dev    # Single app

# Run specific service
pnpm --filter @skillancer/api-gateway dev
```

### Database

```bash
make db-studio           # Open Prisma Studio
make db-migrate          # Run migrations
make db-seed             # Seed data
pnpm db:migrate:create   # Create new migration
```

### Testing

```bash
make test                # All tests
pnpm test -- --watch     # Watch mode
pnpm test:e2e            # E2E tests
pnpm test:coverage       # With coverage
```

### Code Quality

```bash
make lint                # Run ESLint
make format              # Run Prettier
make typecheck           # TypeScript check
make check               # All checks
```

### Docker

```bash
make docker-up           # Start containers
make docker-down         # Stop containers
make docker-logs         # View logs
make docker-reset        # Reset volumes
```

## Troubleshooting

### Tests Failing in CI

1. Pull latest changes: `git pull origin staging`
2. Run tests locally: `pnpm test`
3. Check for environment-specific issues

### Build Failing

1. Clear caches: `make clean`
2. Reinstall dependencies: `pnpm install`
3. Check for TypeScript errors: `pnpm typecheck`

### Docker Issues

```bash
# Reset everything
make docker-reset

# Rebuild images
docker compose build --no-cache
```

## Next Steps

- [Testing Guide](/docs/getting-started/testing) - Detailed testing practices
- [Code Style](/docs/getting-started/code-style) - Coding standards
- [Contributing](/docs/getting-started/contributing) - How to contribute
