# Database Migration Runbook

This runbook provides step-by-step procedures for database migration operations in the Skillancer platform.

## Table of Contents

- [Overview](#overview)
- [Quick Reference](#quick-reference)
- [Routine Procedures](#routine-procedures)
- [Emergency Procedures](#emergency-procedures)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)

## Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Migration Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PR Created ──→ Validate ──→ Preview DB ──→ Review             │
│                      │                          │                │
│                      ▼                          ▼                │
│              Check Destructive           PR Approved             │
│                      │                          │                │
│                      ▼                          ▼                │
│            Comment on PR              Merge to main              │
│                                             │                    │
│                                             ▼                    │
│                                    ┌────────────────┐            │
│                                    │    Staging     │            │
│                                    │  (Automatic)   │            │
│                                    └───────┬────────┘            │
│                                            │                     │
│                                            ▼                     │
│                                    ┌────────────────┐            │
│                                    │   Production   │            │
│                                    │   (Approval)   │            │
│                                    └────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component                         | Purpose                                          |
| --------------------------------- | ------------------------------------------------ |
| `db-migrations.yml`               | GitHub Actions workflow for automated migrations |
| `check-destructive-migrations.ts` | Detects DROP, DELETE, TRUNCATE operations        |
| `acquire-migration-lock.ts`       | Acquires PostgreSQL advisory lock                |
| `release-migration-lock.ts`       | Releases PostgreSQL advisory lock                |
| `rollback-migration.ts`           | Manages migration rollback                       |
| `migration-lock.ts`               | Core lock utilities library                      |

## Quick Reference

### Commands

```bash
# Development
pnpm db:migrate:dev              # Create and apply migration
pnpm db:migrate:create           # Create migration without applying
pnpm db:migrate:status           # Check migration status
pnpm db:studio                   # Open Prisma Studio

# Deployment
pnpm db:migrate:deploy           # Apply pending migrations
pnpm db:check-destructive        # Check for destructive changes

# Locking
pnpm db:lock:acquire             # Acquire migration lock
pnpm db:lock:release             # Release migration lock

# Rollback
pnpm db:migrate:rollback --dry-run          # Preview rollback
pnpm db:migrate:rollback --steps 1 --force  # Roll back 1 migration
```

### Environment Variables

| Variable          | Description                               | Required |
| ----------------- | ----------------------------------------- | -------- |
| `DATABASE_URL`    | PostgreSQL connection string              | Yes      |
| `LOCK_TIMEOUT_MS` | Lock acquisition timeout (default: 30000) | No       |
| `FORCE_RELEASE`   | Force release all locks                   | No       |

## Routine Procedures

### Creating a New Migration

**When:** You need to make schema changes

**Steps:**

1. **Modify schema**

   ```bash
   # Edit packages/database/prisma/schema.prisma
   ```

2. **Generate migration**

   ```bash
   pnpm db:migrate:dev --name add_user_avatar
   ```

3. **Review generated SQL**

   ```bash
   cat packages/database/prisma/migrations/*/migration.sql
   ```

4. **Test locally**

   ```bash
   pnpm db:migrate:status
   pnpm db:studio  # Verify changes
   ```

5. **Commit and push**
   ```bash
   git add packages/database/prisma/
   git commit -m "feat(db): add user avatar field"
   git push
   ```

---

### Checking Migration Status

**When:** Before or after deployments

**Steps:**

1. **Check local status**

   ```bash
   pnpm db:migrate:status
   ```

2. **Check staging**

   ```bash
   DATABASE_URL=$STAGING_DATABASE_URL pnpm db:migrate:status
   ```

3. **Check production**
   ```bash
   DATABASE_URL=$PRODUCTION_DATABASE_URL pnpm db:migrate:status
   ```

---

### Manual Migration Deployment

**When:** Need to deploy outside CI/CD

**Prerequisites:**

- Database credentials
- VPN/bastion access if required
- Notification to team

**Steps:**

1. **Notify team**

   ```
   Post in #engineering: "Starting manual migration to [ENV]"
   ```

2. **Acquire lock**

   ```bash
   DATABASE_URL=$ENV_DATABASE_URL pnpm db:lock:acquire
   ```

3. **Create backup reference**

   ```bash
   echo "Backup: $(date -u +%Y%m%d_%H%M%S)_manual_migration"
   # Ensure RDS snapshot exists or create one via AWS Console
   ```

4. **Apply migrations**

   ```bash
   DATABASE_URL=$ENV_DATABASE_URL pnpm db:migrate:deploy
   ```

5. **Verify success**

   ```bash
   DATABASE_URL=$ENV_DATABASE_URL pnpm db:migrate:status
   ```

6. **Release lock**

   ```bash
   DATABASE_URL=$ENV_DATABASE_URL pnpm db:lock:release
   ```

7. **Notify completion**
   ```
   Post in #engineering: "Migration to [ENV] complete ✅"
   ```

## Emergency Procedures

### Migration Lock is Stuck

**Symptoms:**

- CI pipeline waiting indefinitely
- "Lock already held" errors
- Multiple migration attempts failing

**Steps:**

1. **Check lock status**

   ```bash
   DATABASE_URL=$ENV_DATABASE_URL pnpm db:lock:status
   ```

2. **Identify lock holder**

   ```sql
   -- Connect to database
   SELECT
     l.pid,
     a.usename,
     a.application_name,
     a.state,
     a.query_start,
     age(clock_timestamp(), a.query_start) as duration
   FROM pg_locks l
   JOIN pg_stat_activity a ON l.pid = a.pid
   WHERE l.locktype = 'advisory';
   ```

3. **If safe, force release**

   ```bash
   FORCE_RELEASE=true DATABASE_URL=$ENV_DATABASE_URL pnpm db:lock:release
   ```

4. **If process is stuck, terminate it**
   ```sql
   -- Use PID from step 2
   SELECT pg_terminate_backend(<pid>);
   ```

---

### Migration Failed Mid-Execution

**Symptoms:**

- Partially applied migration
- Schema mismatch errors
- Application errors after migration attempt

**Immediate Actions:**

1. **Do NOT retry immediately**

2. **Assess damage**

   ```bash
   DATABASE_URL=$ENV_DATABASE_URL pnpm db:migrate:status
   ```

3. **Check for partial changes**

   ```sql
   -- List recent schema changes
   SELECT * FROM _prisma_migrations
   ORDER BY finished_at DESC NULLS FIRST
   LIMIT 5;
   ```

4. **If migration not recorded as complete:**
   - Check if tables/columns were created
   - May need manual resolution

5. **Release lock if held**

   ```bash
   DATABASE_URL=$ENV_DATABASE_URL pnpm db:lock:release
   ```

6. **Escalate if needed** - Contact database team

---

### Database Connection Issues During Migration

**Symptoms:**

- Connection timeout during migration
- Network errors
- Lock acquisition failures

**Steps:**

1. **Verify connectivity**

   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. **Check database status**
   - AWS RDS: Check console for instance status
   - Verify security groups allow CI runner IPs

3. **Check for high load**

   ```sql
   SELECT count(*) FROM pg_stat_activity;
   SELECT * FROM pg_stat_activity WHERE state != 'idle';
   ```

4. **Retry with longer timeout**
   ```bash
   LOCK_TIMEOUT_MS=120000 DATABASE_URL=$ENV_DATABASE_URL pnpm db:lock:acquire
   ```

## Troubleshooting

### Common Issues

#### "Migration not found"

**Cause:** Migration files not properly committed or synced

**Solution:**

```bash
git status packages/database/prisma/migrations/
git pull origin main
pnpm db:generate
```

#### "Schema drift detected"

**Cause:** Manual changes made to database outside of migrations

**Solution:**

1. Pull current schema
   ```bash
   pnpm db:pull
   ```
2. Compare with expected schema
3. Either:
   - Create migration to match manual changes
   - Reset database to match migrations (dev only)

#### "Destructive changes detected"

**Cause:** Migration contains DROP, DELETE, or TRUNCATE

**Solution:**

1. Review if changes are intentional
2. Ensure data backup exists
3. Approve via GitHub environment protection rules
4. Or split into non-destructive migrations

#### "Lock already held by PID XXX"

**Cause:** Another migration process is running

**Solution:**

1. Wait for current migration to complete
2. If stuck, check process status (see Emergency Procedures)
3. Force release only if confirmed safe

### Diagnostic Queries

```sql
-- Check Prisma migrations table
SELECT
  id,
  migration_name,
  started_at,
  finished_at,
  applied_steps_count,
  rolled_back_at
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 10;

-- Check active locks
SELECT
  l.locktype,
  l.mode,
  l.granted,
  a.pid,
  a.usename,
  a.application_name,
  a.state,
  a.query
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.locktype = 'advisory';

-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Check table sizes
SELECT
  relname as table,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```

## Rollback Procedures

### When to Rollback

Consider rollback if:

- ❌ Application errors after migration
- ❌ Performance degradation
- ❌ Data integrity issues
- ❌ Business-critical feature broken

Do NOT rollback if:

- ✅ Migration completed successfully
- ✅ No application errors
- ✅ Data looks correct
- ✅ Simply want to make additional changes (create new migration instead)

### Rollback Process

#### 1. Assess Impact

```bash
# Check what migrations exist
pnpm db:migrate:rollback --dry-run

# Check current status
DATABASE_URL=$ENV_DATABASE_URL pnpm db:migrate:status
```

#### 2. Notify Team

```
@channel ALERT: Initiating database rollback on [ENV]
Reason: [Brief description]
Expected duration: [X minutes]
```

#### 3. Create Backup (Production Only)

```bash
# Create RDS snapshot via AWS CLI or Console
aws rds create-db-snapshot \
  --db-instance-identifier skillancer-prod \
  --db-snapshot-identifier pre-rollback-$(date +%Y%m%d%H%M%S)
```

#### 4. Execute Rollback

```bash
# Roll back last migration
DATABASE_URL=$ENV_DATABASE_URL pnpm db:migrate:rollback --steps 1 --force

# Or roll back to specific migration
DATABASE_URL=$ENV_DATABASE_URL pnpm db:migrate:rollback \
  --target 20251208120000_add_user_fields \
  --force
```

#### 5. Verify Application

- Check application logs
- Test critical flows
- Monitor error rates

#### 6. Post-Rollback

1. Document what went wrong
2. Create incident report if production
3. Fix migration and re-deploy properly

### Manual Rollback (Last Resort)

If automated rollback fails:

1. **Stop application traffic** (maintenance mode)

2. **Connect to database directly**

   ```bash
   psql $DATABASE_URL
   ```

3. **Execute rollback SQL manually**

   ```sql
   -- Example: Reverse a column addition
   ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;

   -- Mark migration as rolled back
   UPDATE _prisma_migrations
   SET rolled_back_at = NOW()
   WHERE migration_name = '20251208120000_add_user_avatar';
   ```

4. **Verify schema state**

5. **Restart application**

6. **Run full test suite**

## Contact Information

| Role          | Contact   | When                   |
| ------------- | --------- | ---------------------- |
| Database Team | #db-team  | Schema issues, locks   |
| Platform Team | #platform | CI/CD issues           |
| On-Call       | PagerDuty | Production emergencies |

---

## Version History

| Date       | Version | Author          | Changes         |
| ---------- | ------- | --------------- | --------------- |
| 2024-12-08 | 1.0.0   | Skillancer Team | Initial runbook |
