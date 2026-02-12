# Database Rollback Procedures

This document describes emergency rollback procedures for database migrations in the Skillancer platform.

## Quick Reference

| Scenario                 | Action                   | Command/Steps                                      |
| ------------------------ | ------------------------ | -------------------------------------------------- |
| Migration failed mid-way | Mark as rolled back      | `pnpm db:migrate:resolve --rolled-back <name>`     |
| Need to undo a migration | Create reverse migration | See [Option 2](#option-2-create-reverse-migration) |
| Catastrophic failure     | Point-in-time recovery   | See [Option 3](#option-3-point-in-time-recovery)   |

## Emergency Contacts

Before performing any rollback in production:

1. **Notify the team** via Slack `#engineering`
2. **Create an incident** if user-facing impact
3. **Document actions** in the incident channel

---

## Option 1: Prisma Migrate Resolve

**Use when:** Migration failed partway through and needs to be marked as failed.

### Scenario

The migration started but failed mid-execution, leaving the database in an inconsistent state.

### Steps

```bash
# 1. Check migration status
pnpm db:migrate:status

# 2. If migration is partially applied, mark it as rolled back
pnpm db:migrate:resolve --rolled-back 20251208120000_problematic_migration

# 3. Verify status
pnpm db:migrate:status

# 4. Fix the migration file or create a new one
# Edit: packages/database/prisma/migrations/20251208120000_problematic_migration/migration.sql

# 5. Re-run migrations
pnpm db:migrate:deploy
```

### When to Use

- ✅ Migration failed with an error
- ✅ Database is in known state
- ✅ Can identify which changes were applied

### When NOT to Use

- ❌ Migration completed successfully
- ❌ Unknown database state
- ❌ Data corruption detected

---

## Option 2: Create Reverse Migration

**Use when:** A migration completed successfully but needs to be undone.

### Scenario

A deployed migration is causing issues in production and needs to be reversed.

### Steps

```bash
# 1. Create a new migration with reverse operations
pnpm db:migrate:create --name revert_20251208120000_add_column

# 2. Edit the migration file with reverse SQL
```

### Example: Reversing Common Operations

#### Revert ADD COLUMN

```sql
-- Original migration added a column
-- Reverse: DROP COLUMN

ALTER TABLE "users" DROP COLUMN "new_column";
```

#### Revert DROP COLUMN (requires backup)

```sql
-- ⚠️ Data may be lost! Restore from backup if needed.

-- 1. Re-create the column
ALTER TABLE "users" ADD COLUMN "deleted_column" VARCHAR(255);

-- 2. Restore data from backup table (if available)
UPDATE "users" u
SET "deleted_column" = b."deleted_column"
FROM "users_backup" b
WHERE u.id = b.id;
```

#### Revert CREATE TABLE

```sql
-- Original migration created a table
-- Reverse: DROP TABLE

DROP TABLE IF EXISTS "new_table" CASCADE;
```

#### Revert DROP TABLE (requires backup)

```sql
-- ⚠️ Must restore from backup!
-- 1. Restore table structure and data from RDS snapshot
-- 2. Or use pg_dump backup if available
```

#### Revert ADD INDEX

```sql
-- Original migration added an index
-- Reverse: DROP INDEX

DROP INDEX IF EXISTS "idx_users_email";
```

### Testing the Reverse Migration

```bash
# 1. Test in development
pnpm db:migrate:reset
pnpm db:migrate:dev

# 2. Test in staging
# Deploy to staging and verify

# 3. Deploy to production
pnpm db:migrate:deploy
```

---

## Option 3: Point-in-Time Recovery

**Use when:** Catastrophic failure requiring database restoration.

### Scenario

- Data corruption detected
- Multiple migrations need to be undone
- Unknown database state

### Prerequisites

- AWS RDS automated backups enabled
- Recent snapshot available

### Steps

#### 1. Identify Recovery Point

```bash
# Find the timestamp before the problematic migration
# Check migration history and deployment logs

# AWS CLI: List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier skillancer-production
```

#### 2. Restore from Snapshot (AWS RDS)

```bash
# Create new instance from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier skillancer-production-recovery \
  --db-snapshot-identifier rds:skillancer-production-2024-01-15-00-00 \
  --db-instance-class db.t3.medium

# Wait for instance to be available
aws rds wait db-instance-available \
  --db-instance-identifier skillancer-production-recovery
```

#### 3. Verify Restored Database

```bash
# Connect to restored instance and verify data
psql -h skillancer-production-recovery.xxx.rds.amazonaws.com \
  -U skillancer_admin -d skillancer

# Check recent records
SELECT COUNT(*) FROM users WHERE created_at > '2024-01-14';
```

#### 4. Switch Traffic

```bash
# Update application DATABASE_URL to point to restored instance
# This depends on your deployment setup (env vars, secrets manager, etc.)

# If using AWS Secrets Manager:
aws secretsmanager update-secret \
  --secret-id skillancer/production/database \
  --secret-string '{"url":"postgresql://..."}'
```

#### 5. Re-apply Safe Migrations

```bash
# Check migration status on restored database
pnpm db:migrate:status

# Apply only the safe migrations
pnpm db:migrate:deploy
```

#### 6. Cleanup

```bash
# After verifying everything works, delete the old instance
aws rds delete-db-instance \
  --db-instance-identifier skillancer-production-old \
  --skip-final-snapshot
```

---

## Option 4: Manual SQL Rollback

**Use when:** Need precise control over rollback operations.

### Scenario

- Complex rollback with data preservation
- Partial rollback needed

### Steps

```bash
# 1. Connect to database
psql $DATABASE_URL

# 2. Start transaction
BEGIN;

# 3. Execute rollback SQL
-- Your rollback statements here

# 4. Verify changes
SELECT * FROM affected_table LIMIT 10;

# 5. Commit or rollback
COMMIT;  -- if everything looks good
-- or
ROLLBACK;  -- if something is wrong
```

### Example: Safe Column Removal

```sql
BEGIN;

-- 1. Create backup table
CREATE TABLE users_column_backup AS
SELECT id, column_to_remove FROM users;

-- 2. Drop the column
ALTER TABLE users DROP COLUMN column_to_remove;

-- 3. Update Prisma migration history
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251208120000_add_column_to_remove';

COMMIT;
```

---

## Rollback Checklist

Before performing any rollback:

- [ ] **Backup current state** - Take a snapshot before making changes
- [ ] **Notify team** - Alert via Slack `#engineering`
- [ ] **Check dependencies** - Ensure no application code depends on changes
- [ ] **Test in staging** - Verify rollback works in staging first
- [ ] **Schedule maintenance window** - If user-facing impact expected
- [ ] **Prepare verification queries** - Know how to verify success
- [ ] **Document everything** - Keep record of all actions taken

After rollback:

- [ ] **Verify application functionality** - Test critical paths
- [ ] **Check error rates** - Monitor for new errors
- [ ] **Update incident** - Document resolution
- [ ] **Root cause analysis** - Understand what went wrong
- [ ] **Update procedures** - Improve for next time

---

## Prevention Best Practices

### Before Deploying Migrations

1. **Always test in staging first**
2. **Create backup before destructive changes**
3. **Have rollback SQL ready** for complex migrations
4. **Use feature flags** for related code changes
5. **Deploy during low-traffic periods**

### Database Backup Strategy

| Environment | Backup Type     | Retention | Frequency         |
| ----------- | --------------- | --------- | ----------------- |
| Production  | RDS Automated   | 30 days   | Continuous        |
| Production  | Manual Snapshot | 90 days   | Before migrations |
| Staging     | RDS Automated   | 7 days    | Continuous        |
| Development | None            | -         | -                 |

### Migration Safety Checklist

Before creating a migration:

- [ ] Is this change backward compatible?
- [ ] Can the application work with both old and new schema?
- [ ] Is there a data migration needed?
- [ ] What's the rollback plan?
- [ ] Is this change reversible?

---

## See Also

- [Migrations Guide](./migrations.md)
- [Data Migrations](./data-migrations.md)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
