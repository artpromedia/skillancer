# Database Operations Runbook

This runbook covers database operations, backup procedures, and troubleshooting for Skillancer.

## Backup Verification

### Automated Backup Schedule

| Type             | Frequency        | Retention | Storage      |
| ---------------- | ---------------- | --------- | ------------ |
| Continuous (WAL) | Real-time        | 7 days    | S3           |
| Snapshot         | Daily            | 30 days   | S3           |
| Weekly           | Sunday 02:00 UTC | 90 days   | S3 + Glacier |
| Monthly          | 1st of month     | 1 year    | Glacier      |

### Verify Backup Status

```bash
# Check latest backup
aws rds describe-db-snapshots \
  --db-instance-identifier skillancer-production \
  --query 'DBSnapshots[-1].[DBSnapshotIdentifier,SnapshotCreateTime,Status]'

# List all backups
aws rds describe-db-snapshots \
  --db-instance-identifier skillancer-production \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
  --output table
```

### Weekly Backup Restoration Test

**Every Sunday, verify backup integrity:**

```bash
# 1. Create test instance from latest backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier skillancer-backup-test \
  --db-snapshot-identifier rds:skillancer-production-$(date +%Y-%m-%d) \
  --db-instance-class db.t3.medium

# 2. Wait for instance to be available
aws rds wait db-instance-available \
  --db-instance-identifier skillancer-backup-test

# 3. Run verification queries
psql $BACKUP_TEST_URL -f ./scripts/verify-backup.sql

# 4. Delete test instance
aws rds delete-db-instance \
  --db-instance-identifier skillancer-backup-test \
  --skip-final-snapshot
```

### Cross-Region Replication

Backups are replicated to secondary region:

| Primary   | Secondary |
| --------- | --------- |
| us-east-1 | eu-west-1 |

```bash
# Verify cross-region copy
aws rds describe-db-snapshots \
  --region eu-west-1 \
  --query 'DBSnapshots[?contains(DBSnapshotIdentifier, `skillancer-production`)]'
```

---

## Point-in-Time Recovery

### When to Use

- Data corruption detected
- Accidental deletion
- Need to recover to specific moment

### Recovery Procedure

#### 1. Identify Target Timestamp

```bash
# Check when issue occurred (from logs/monitoring)
# Example: 2024-01-15 14:30:00 UTC

# Verify WAL availability
aws rds describe-db-instances \
  --db-instance-identifier skillancer-production \
  --query 'DBInstances[0].LatestRestorableTime'
```

#### 2. Create Recovery Instance

```bash
# Restore to specific point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier skillancer-production \
  --target-db-instance-identifier skillancer-recovery-$(date +%Y%m%d) \
  --restore-time 2024-01-15T14:30:00Z \
  --db-instance-class db.r6g.xlarge

# Wait for instance
aws rds wait db-instance-available \
  --db-instance-identifier skillancer-recovery-$(date +%Y%m%d)
```

#### 3. Verify Data Integrity

```bash
# Connect to recovery instance
psql $RECOVERY_DB_URL

# Run integrity checks
SELECT count(*) FROM users;
SELECT count(*) FROM contracts WHERE created_at > '2024-01-15 14:30:00';
-- Compare with expected values
```

#### 4. Swap Connections (Full Recovery)

**Only if full database replacement needed:**

```bash
# 1. Enable maintenance mode
./scripts/maintenance-mode.sh enable

# 2. Wait for connections to drain
sleep 60

# 3. Rename instances
aws rds modify-db-instance \
  --db-instance-identifier skillancer-production \
  --new-db-instance-identifier skillancer-production-old

aws rds modify-db-instance \
  --db-instance-identifier skillancer-recovery-$(date +%Y%m%d) \
  --new-db-instance-identifier skillancer-production

# 4. Update connection strings in secrets manager
aws secretsmanager update-secret \
  --secret-id skillancer/production/database \
  --secret-string '{"url": "new-connection-string"}'

# 5. Restart services
kubectl rollout restart deployment -n production

# 6. Disable maintenance mode
./scripts/maintenance-mode.sh disable
```

---

## Schema Migrations

### Best Practices

1. **Always use Prisma migrations** - Never modify schema directly
2. **Test on staging first** - With production data copy
3. **Run during low-traffic** - Tuesday-Thursday, 14:00-16:00 UTC
4. **Have rollback ready** - Prepare rollback migration

### Migration Workflow

#### 1. Create Migration

```bash
# Generate migration
pnpm prisma migrate dev --name add_new_feature

# Review generated SQL
cat prisma/migrations/20240115_add_new_feature/migration.sql
```

#### 2. Test on Staging

```bash
# Apply to staging
DATABASE_URL=$STAGING_DB_URL pnpm prisma migrate deploy

# Verify application works
pnpm test:e2e --env=staging
```

#### 3. Production Deployment

```bash
# Pre-deployment backup
aws rds create-db-snapshot \
  --db-instance-identifier skillancer-production \
  --db-snapshot-identifier pre-migration-$(date +%Y%m%d%H%M)

# Run migration
DATABASE_URL=$PRODUCTION_DB_URL pnpm prisma migrate deploy

# Verify migration
pnpm prisma migrate status
```

### Rollback Migration

```bash
# If migration fails, restore from pre-migration snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier skillancer-recovery \
  --db-snapshot-identifier pre-migration-20240115

# Or run rollback SQL
psql $DATABASE_URL < prisma/migrations/20240115_add_new_feature/rollback.sql
```

### High-Risk Migrations

For migrations affecting large tables:

```sql
-- Use concurrent index creation
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- Add columns without default (faster)
ALTER TABLE users ADD COLUMN new_field TEXT;

-- Backfill in batches
UPDATE users SET new_field = 'default' WHERE id BETWEEN 0 AND 10000;
UPDATE users SET new_field = 'default' WHERE id BETWEEN 10001 AND 20000;
-- ...continue in batches
```

---

## Performance Troubleshooting

### Check Slow Query Log

```sql
-- Enable slow query logging (if not already)
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1 second
SELECT pg_reload_conf();

-- View slow queries
SELECT
  calls,
  mean_time::int as avg_ms,
  max_time::int as max_ms,
  query
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

### Analyze Query Plans

```sql
-- Get execution plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM jobs WHERE status = 'open' AND category_id = 'cat_web';

-- Look for:
-- - Sequential scans on large tables
-- - High buffer reads
-- - Nested loop with high row counts
```

### Check Index Usage

```sql
-- Unused indexes (candidates for removal)
SELECT
  schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexname NOT LIKE '%pkey%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Missing indexes (tables with many sequential scans)
SELECT
  schemaname, tablename,
  seq_scan, seq_tup_read,
  idx_scan, idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_tup_read DESC
LIMIT 20;
```

### Connection Pool Monitoring

```sql
-- Current connections
SELECT
  state,
  count(*),
  max(now() - state_change) as max_duration
FROM pg_stat_activity
WHERE datname = 'skillancer'
GROUP BY state;

-- Kill long-running queries (> 5 minutes)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'skillancer'
AND state = 'active'
AND now() - query_start > interval '5 minutes';
```

### Check Table Bloat

```sql
-- Estimate table bloat
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
  pg_size_pretty(pg_table_size(tablename::regclass)) as table_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC
LIMIT 20;

-- Run VACUUM ANALYZE on bloated tables
VACUUM ANALYZE jobs;
VACUUM ANALYZE proposals;
```

---

## Emergency Procedures

### Database Overloaded

```bash
# 1. Scale up instance (temporary)
aws rds modify-db-instance \
  --db-instance-identifier skillancer-production \
  --db-instance-class db.r6g.2xlarge \
  --apply-immediately

# 2. Kill expensive queries
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > interval '2 minutes';"

# 3. Enable read replica routing
kubectl apply -f k8s/database/read-replica-routing.yaml
```

### Replication Lag

```bash
# Check replica lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name ReplicaLag \
  --dimensions Name=DBInstanceIdentifier,Value=skillancer-replica-1 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 \
  --statistics Average

# If lag > 60 seconds, reduce read traffic
kubectl scale deployment/api-gateway --replicas=5
```

### Disk Space Critical

```bash
# Check disk usage
aws rds describe-db-instances \
  --db-instance-identifier skillancer-production \
  --query 'DBInstances[0].AllocatedStorage'

# Increase storage
aws rds modify-db-instance \
  --db-instance-identifier skillancer-production \
  --allocated-storage 500 \
  --apply-immediately

# Clean up old data (if safe)
DELETE FROM audit_logs WHERE created_at < now() - interval '90 days';
VACUUM FULL audit_logs;
```

---

## Regular Maintenance

### Weekly Tasks

- [ ] Review slow query log
- [ ] Check index usage statistics
- [ ] Verify backup test results
- [ ] Review connection pool metrics

### Monthly Tasks

- [ ] Analyze table bloat
- [ ] Run VACUUM ANALYZE on all tables
- [ ] Review and update statistics
- [ ] Test disaster recovery procedure

### Quarterly Tasks

- [ ] Review and optimize indexes
- [ ] Evaluate instance sizing
- [ ] Security patch review
- [ ] Cross-region recovery test
