# Database Migrations

Guide for running and managing database migrations in production.

**Last Verified**: 2024-01-25  
**Owner**: DevOps Team

## Overview

Database migrations modify the schema of our PostgreSQL databases. This runbook covers safe migration procedures for different scenarios.

## Prerequisites

- [ ] Access to database credentials (via AWS Secrets Manager)
- [ ] VPN connected (for direct database access)
- [ ] Migration reviewed and approved
- [ ] Backup verified (automatic daily, verify recent)
- [ ] Low-traffic window identified (if applicable)

## Pre-Migration Checklist

```bash
# 1. Check current migration status
pnpm prisma migrate status

# 2. Review pending migrations
cat prisma/migrations/*/migration.sql

# 3. Verify backup exists
aws rds describe-db-snapshots \
  --db-instance-identifier skillancer-production \
  --query 'DBSnapshots[0].{ID:DBSnapshotIdentifier,Time:SnapshotCreateTime}'

# 4. Check database size and connections
psql $DATABASE_URL -c "
  SELECT pg_size_pretty(pg_database_size(current_database())) as db_size,
         count(*) as active_connections
  FROM pg_stat_activity
  WHERE state = 'active';
"
```

## Migration Procedures

### Standard Migration (via CI/CD)

Most migrations run automatically during deployment:

1. **PR includes migration files**
2. **CI runs migration in staging**
3. **After staging verification, merge to main**
4. **CD runs `prisma migrate deploy` before new pods start**

### Manual Migration (When Needed)

:::warning
Manual migrations should be rare. Use when CI/CD is unavailable or for emergency fixes.
:::

```bash
# 1. Connect to bastion host
ssh bastion.skillancer.internal

# 2. Set database URL
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id skillancer/production/database \
  --query SecretString --output text | jq -r '.url')

# 3. Check migration status
npx prisma migrate status

# 4. Run migrations
npx prisma migrate deploy

# 5. Verify migration applied
npx prisma migrate status
```

## Migration Types

### Safe Migrations (No Downtime)

These can run anytime:

- Adding new tables
- Adding nullable columns
- Adding indexes (with `CONCURRENTLY`)
- Adding new enum values

```sql
-- Example: Safe column addition
ALTER TABLE users ADD COLUMN bio TEXT;

-- Example: Safe index (use CONCURRENTLY)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

### Careful Migrations (Plan Required)

These need planning:

- Adding NOT NULL columns
- Changing column types
- Dropping columns/tables
- Modifying indexes on large tables

```sql
-- Example: Adding NOT NULL column (3-step process)
-- Step 1: Add nullable column
ALTER TABLE users ADD COLUMN status TEXT;

-- Step 2: Backfill data (run in batches)
UPDATE users SET status = 'active' WHERE status IS NULL LIMIT 1000;

-- Step 3: Add constraint (after all rows updated)
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
```

### Dangerous Migrations (Maintenance Window)

These may require downtime:

- Renaming columns/tables used by app
- Changing primary keys
- Large data migrations
- Dropping columns still referenced by old code

## Rollback Procedures

### Rollback via Prisma

Prisma doesn't have automatic down migrations. Options:

1. **Create a new migration that reverses changes**

   ```bash
   # Create manual rollback migration
   pnpm prisma migrate dev --name rollback_feature_x --create-only

   # Edit the migration SQL manually
   # Then apply
   pnpm prisma migrate deploy
   ```

2. **Restore from backup** (last resort)

### Creating Rollback SQL

Always prepare rollback SQL before applying:

```sql
-- Migration: Add status column
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';

-- Rollback SQL (save this!)
ALTER TABLE users DROP COLUMN status;
```

### Point-in-Time Recovery

For data corruption issues:

```bash
# 1. Identify the time before corruption
# Check CloudWatch logs for exact timestamp

# 2. Create restore from point-in-time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier skillancer-production \
  --target-db-instance-identifier skillancer-recovery \
  --restore-time "2024-01-25T10:30:00Z"

# 3. Once restored, extract needed data or swap instances
```

## Large Table Migrations

For tables with millions of rows:

### Adding Indexes

```sql
-- Use CONCURRENTLY to avoid locking
CREATE INDEX CONCURRENTLY idx_projects_created
ON projects(created_at);

-- Monitor progress
SELECT
  phase,
  blocks_total,
  blocks_done,
  tuples_total,
  tuples_done
FROM pg_stat_progress_create_index;
```

### Backfilling Data

```bash
#!/bin/bash
# Batch update script

BATCH_SIZE=1000
TOTAL=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM users WHERE new_column IS NULL")

echo "Total rows to update: $TOTAL"

while true; do
  UPDATED=$(psql $DATABASE_URL -t -c "
    WITH batch AS (
      SELECT id FROM users
      WHERE new_column IS NULL
      LIMIT $BATCH_SIZE
    )
    UPDATE users SET new_column = 'default'
    WHERE id IN (SELECT id FROM batch)
    RETURNING id;
  " | wc -l)

  if [ "$UPDATED" -eq 0 ]; then
    echo "Backfill complete"
    break
  fi

  echo "Updated $UPDATED rows..."
  sleep 0.5  # Throttle to reduce load
done
```

## Verification

After migration:

```bash
# 1. Check migration status
pnpm prisma migrate status

# 2. Verify schema matches
pnpm prisma validate

# 3. Run schema comparison
psql $DATABASE_URL -c "\d+ <table_name>"

# 4. Check application health
curl https://api.skillancer.com/health

# 5. Monitor error rates for 15 minutes
```

## Troubleshooting

### Migration Failed Mid-Way

```bash
# Check failed migration status
pnpm prisma migrate status

# If partially applied, may need to:
# 1. Manually complete the migration
# 2. Or manually rollback partial changes
# 3. Mark migration as applied
pnpm prisma migrate resolve --applied <migration_name>
```

### Lock Timeout

```sql
-- Find blocking queries
SELECT
  blocked.pid AS blocked_pid,
  blocking.pid AS blocking_pid,
  blocked.query AS blocked_query,
  blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.pid != blocking.pid;

-- If safe, terminate blocking query
SELECT pg_terminate_backend(<blocking_pid>);
```

### Out of Disk Space

```sql
-- Check table sizes
SELECT
  relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;

-- Run vacuum to reclaim space
VACUUM (VERBOSE, ANALYZE) <table_name>;
```

## Best Practices

1. **Always test in staging first**
2. **Prepare rollback SQL before applying**
3. **Run during low-traffic periods for large changes**
4. **Use `CONCURRENTLY` for index operations**
5. **Batch large data updates**
6. **Monitor performance during migration**
7. **Keep migrations small and focused**

## Related Runbooks

- [Production Deployment](./production)
- [Rollback Procedures](./rollback)
- [Database Maintenance](../maintenance/database)
