# Database Migrations Guide

This document describes the database migration workflow for the Skillancer platform.

## Overview

Skillancer uses **Prisma ORM** with **PostgreSQL** for database management. Migrations are handled through Prisma Migrate and deployed via CI/CD pipelines.

## Quick Reference

### Common Commands

```bash
# Development
pnpm db:migrate:dev      # Create and apply new migration
pnpm db:migrate:create   # Create migration without applying
pnpm db:push             # Push schema changes (dev only, no migration)
pnpm db:studio           # Open Prisma Studio GUI

# Deployment
pnpm db:migrate:deploy   # Apply pending migrations (production)
pnpm db:migrate:status   # Check migration status
pnpm db:migrate:reset    # Reset database (⚠️ DESTRUCTIVE)

# Utilities
pnpm db:generate         # Regenerate Prisma Client
pnpm db:seed             # Seed database with test data
pnpm db:pull             # Pull schema from existing database
pnpm db:check-destructive # Check for destructive changes
```

## Migration Workflow

### 1. Local Development

#### Creating a New Migration

1. **Modify the schema** in `packages/database/prisma/schema.prisma`

2. **Generate migration**:
   ```bash
   pnpm db:migrate:dev --name add_user_verification_fields
   ```

3. **Review the generated SQL** in `prisma/migrations/[timestamp]_[name]/migration.sql`

4. **Test locally** with your development database

#### Migration Naming Convention

Format: `YYYYMMDDHHMMSS_descriptive_name`

Examples:
- `20251208120000_add_user_verification_fields`
- `20251208130000_create_audit_logs_table`
- `20251208140000_add_index_jobs_status`
- `20251208150000_rename_column_user_name`
- `20251208160000_drop_legacy_sessions_table`

Good practices:
- Use **snake_case** for migration names
- Start with a **verb** (add, create, remove, rename, update)
- Be **descriptive** but concise
- Include the **table name** when relevant

### 2. Code Review Process

When submitting a PR with database changes:

1. **Include migration files** in your PR
2. **Document breaking changes** in PR description
3. **Provide rollback procedure** for destructive changes
4. **Include data migration script** if needed

The CI pipeline will:
- ✅ Validate the Prisma schema
- ✅ Check for destructive changes
- ✅ Run migrations against a preview database
- ✅ Comment on the PR with migration status

### 3. Deployment Pipeline

```
PR Created → Validate → Preview DB → Review → Merge
                                               ↓
                                           Staging → Production
```

#### Staging Deployment
- Automatically triggered on merge to `main`/`master`
- Migrations applied to staging database
- Slack notification sent on success/failure

#### Production Deployment
- Requires staging migration success
- Manual approval required for destructive changes
- Slack notification sent on success/failure

## Environment Configuration

### Required Secrets

Configure these in GitHub repository settings:

| Secret | Environment | Description |
|--------|-------------|-------------|
| `STAGING_DATABASE_URL` | staging | PostgreSQL connection string for staging |
| `PRODUCTION_DATABASE_URL` | production | PostgreSQL connection string for production |
| `SLACK_WEBHOOK_URL` | all | Slack webhook for notifications |

### Database URL Format

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&connection_limit=5
```

Recommended connection parameters:
- `connection_limit=5` - Prevent connection exhaustion
- `pool_timeout=10` - Connection pool timeout
- `connect_timeout=10` - Connection timeout

## Working with Multiple Developers

### Avoiding Conflicts

1. **Communicate** before making schema changes
2. **Pull latest migrations** before creating new ones
3. **Use unique migration names** (timestamps help)
4. **Resolve conflicts** by rebasing and regenerating

### Handling Migration Conflicts

If two developers create migrations at the same time:

```bash
# 1. Pull latest changes
git pull origin main

# 2. Reset your local migration
pnpm db:migrate:reset

# 3. Rebase your changes
git rebase main

# 4. Regenerate migration with new timestamp
pnpm db:migrate:dev --name your_migration_name
```

## Best Practices

### DO ✅

- **Test migrations locally** before pushing
- **Back up data** before destructive migrations
- **Use transactions** for data migrations
- **Include indexes** for frequently queried columns
- **Document breaking changes** in PR description
- **Create rollback scripts** for complex migrations

### DON'T ❌

- **Don't modify existing migrations** that have been deployed
- **Don't delete migration files** from the history
- **Don't use `db:push` in production** (use `migrate:deploy`)
- **Don't skip the staging environment**
- **Don't make breaking changes** without team coordination

## Destructive Changes

The following operations are flagged as destructive:

| Severity | Operations |
|----------|------------|
| 🔴 High | `DROP TABLE`, `DROP COLUMN`, `DELETE FROM`, `TRUNCATE` |
| 🟡 Medium | `DROP INDEX`, `DROP CONSTRAINT`, `ALTER COLUMN TYPE` |

### Handling Destructive Migrations

1. **Run the checker**:
   ```bash
   pnpm db:check-destructive
   ```

2. **Document the impact** in your PR

3. **Provide rollback procedure**

4. **Wait for manual approval** in CI

## Migration Lock

For data migrations and long-running operations, use the migration lock:

```typescript
import { prisma, withMigrationLock } from '@skillancer/database';

await withMigrationLock(prisma, async () => {
  // Your migration logic here
  await migrateUserData();
});
```

This prevents concurrent migrations from running.

## Troubleshooting

### "Migration failed to apply cleanly"

```bash
# Check current status
pnpm db:migrate:status

# If partially applied, resolve as rolled back
pnpm db:migrate:resolve --rolled-back MIGRATION_NAME

# Fix the issue and retry
pnpm db:migrate:dev
```

### "Drift detected"

Schema drift means your database differs from your migrations:

```bash
# Option 1: Create migration to match current state
pnpm db:migrate:dev --name sync_schema

# Option 2: Reset database (dev only)
pnpm db:migrate:reset
```

### "Cannot drop table/column in use"

Ensure no active connections are using the table:

```sql
-- Check active queries
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Terminate connections (be careful!)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'your_database' AND pid <> pg_backend_pid();
```

## See Also

- [Rollback Procedures](./rollback.md)
- [Data Migration Guide](./data-migrations.md)
- [Prisma Documentation](https://www.prisma.io/docs/)
