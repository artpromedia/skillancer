# Database Maintenance

Regular maintenance procedures for PostgreSQL databases.

**Last Verified**: 2024-01-25  
**Owner**: DevOps Team

## Overview

Regular database maintenance ensures optimal performance and prevents issues. This includes vacuuming, reindexing, analyzing statistics, and managing backups.

## Scheduled Maintenance

| Task                   | Frequency | Time (UTC)       | Automated        |
| ---------------------- | --------- | ---------------- | ---------------- |
| VACUUM ANALYZE         | Daily     | 03:00            | Yes (autovacuum) |
| Full statistics update | Weekly    | Sunday 04:00     | No               |
| Bloat check            | Weekly    | Monday 09:00     | No               |
| Backup verification    | Weekly    | Sunday 06:00     | Semi             |
| Index maintenance      | Monthly   | 1st Sunday 04:00 | No               |

## Daily Maintenance (Automated)

PostgreSQL's autovacuum handles daily maintenance. Verify it's working:

```sql
-- Check autovacuum status
SELECT
  schemaname,
  relname,
  last_vacuum,
  last_autovacuum,
  vacuum_count,
  autovacuum_count
FROM pg_stat_user_tables
ORDER BY last_autovacuum DESC NULLS LAST
LIMIT 20;

-- Check for tables that haven't been vacuumed recently
SELECT
  schemaname,
  relname,
  n_dead_tup,
  last_autovacuum
FROM pg_stat_user_tables
WHERE last_autovacuum < now() - interval '7 days'
   OR last_autovacuum IS NULL
ORDER BY n_dead_tup DESC;
```

## Weekly Maintenance

### Statistics Update

```sql
-- Update statistics for all tables
ANALYZE VERBOSE;

-- Or specific high-traffic tables
ANALYZE VERBOSE users;
ANALYZE VERBOSE projects;
ANALYZE VERBOSE bookings;
```

### Check Table Bloat

```sql
-- Estimate table bloat
WITH constants AS (
  SELECT current_setting('block_size')::numeric AS bs
),
bloat_info AS (
  SELECT
    schemaname,
    tablename,
    cc.reltuples::bigint AS num_rows,
    cc.relpages::bigint AS pages,
    COALESCE(
      CEIL(
        cc.reltuples /
        ((bs - page_hdr) / (tpl_size + ma - (CASE WHEN tpl_size%ma = 0 THEN ma ELSE tpl_size%ma END)))
      ), 0
    ) AS est_pages
  FROM pg_class cc
  JOIN pg_namespace nn ON cc.relnamespace = nn.oid
  CROSS JOIN constants
  CROSS JOIN LATERAL (
    SELECT 23 AS page_hdr, 4 AS ma,
           (SELECT sum(attlen) FROM pg_attribute WHERE attrelid = cc.oid AND attnum > 0) AS tpl_size
  ) AS consts
  WHERE nn.nspname = 'public'
    AND cc.relkind = 'r'
)
SELECT
  schemaname,
  tablename,
  num_rows,
  pages AS actual_pages,
  est_pages AS estimated_pages,
  ROUND(100 * (pages - est_pages)::numeric / NULLIF(pages, 0), 2) AS bloat_pct
FROM bloat_info
WHERE pages > 100
ORDER BY bloat_pct DESC NULLS LAST
LIMIT 20;
```

### Check Index Bloat

```sql
-- Check index usage and bloat
SELECT
  schemaname,
  relname AS table,
  indexrelname AS index,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Unused indexes (candidates for removal)
SELECT
  schemaname,
  relname AS table,
  indexrelname AS index,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Backup Verification

```bash
# List recent backups (RDS)
aws rds describe-db-snapshots \
  --db-instance-identifier skillancer-production \
  --query 'DBSnapshots[0:7].{ID:DBSnapshotIdentifier,Time:SnapshotCreateTime,Status:Status}'

# Verify backup is restorable (monthly test)
# See "Backup Testing" section below
```

## Monthly Maintenance

### Reindex Bloated Indexes

```sql
-- Reindex without locking (PostgreSQL 12+)
REINDEX INDEX CONCURRENTLY idx_users_email;
REINDEX INDEX CONCURRENTLY idx_projects_created_at;

-- Or reindex entire table's indexes
REINDEX TABLE CONCURRENTLY users;
```

### Full Vacuum on High-Churn Tables

```sql
-- For tables with significant bloat (> 30%)
-- This requires exclusive lock, schedule during low traffic

-- Check current connections first
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Run full vacuum
VACUUM (FULL, VERBOSE) logs;
VACUUM (FULL, VERBOSE) audit_events;
```

### Review and Clean Old Data

```sql
-- Check table sizes
SELECT
  relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  n_live_tup AS rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- Archive/delete old logs (if applicable)
-- First, backup if needed
-- DELETE FROM logs WHERE created_at < now() - interval '90 days';
-- VACUUM logs;
```

## Backup Management

### Manual Backup

```bash
# Create manual snapshot (RDS)
aws rds create-db-snapshot \
  --db-instance-identifier skillancer-production \
  --db-snapshot-identifier skillancer-manual-$(date +%Y%m%d)

# Wait for completion
aws rds wait db-snapshot-completed \
  --db-snapshot-identifier skillancer-manual-$(date +%Y%m%d)
```

### Backup Testing (Quarterly)

```bash
# 1. Restore snapshot to test instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier skillancer-backup-test \
  --db-snapshot-identifier <latest-snapshot-id> \
  --db-instance-class db.t3.medium

# 2. Wait for instance to be available
aws rds wait db-instance-available \
  --db-instance-identifier skillancer-backup-test

# 3. Connect and verify data
psql -h <test-instance-endpoint> -U skillancer -d skillancer -c "
  SELECT 'users' as table, count(*) as count FROM users
  UNION ALL
  SELECT 'projects', count(*) FROM projects
  UNION ALL
  SELECT 'bookings', count(*) FROM bookings;
"

# 4. Clean up test instance
aws rds delete-db-instance \
  --db-instance-identifier skillancer-backup-test \
  --skip-final-snapshot
```

### Backup Retention

```bash
# Check backup retention period
aws rds describe-db-instances \
  --db-instance-identifier skillancer-production \
  --query 'DBInstances[0].BackupRetentionPeriod'

# Modify if needed (max 35 days for RDS)
aws rds modify-db-instance \
  --db-instance-identifier skillancer-production \
  --backup-retention-period 30
```

## Performance Optimization

### Identify Slow Queries

```sql
-- Enable pg_stat_statements if not enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top slow queries
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_time_ms,
  round(mean_exec_time::numeric, 2) AS mean_time_ms,
  round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS pct,
  query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Reset statistics (do this periodically)
SELECT pg_stat_statements_reset();
```

### Check Missing Indexes

```sql
-- Tables with high sequential scan ratio
SELECT
  schemaname,
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  CASE
    WHEN idx_scan = 0 THEN 'No index scans'
    ELSE round((seq_tup_read / idx_scan)::numeric, 2)::text
  END AS ratio
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC
LIMIT 20;
```

### Connection Pool Health

```sql
-- Current connections by application
SELECT
  application_name,
  state,
  count(*)
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY application_name, state
ORDER BY count(*) DESC;

-- Long-running connections
SELECT
  pid,
  application_name,
  state,
  query_start,
  now() - query_start AS duration,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '1 minute'
ORDER BY query_start;
```

## Emergency Procedures

### Kill Long-Running Queries

```sql
-- Find queries running > 5 minutes
SELECT pid, query, now() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '5 minutes';

-- Cancel query (graceful)
SELECT pg_cancel_backend(<pid>);

-- Terminate connection (force)
SELECT pg_terminate_backend(<pid>);
```

### Clear Connection Pool

```sql
-- Terminate all non-system idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND usename != 'postgres'
  AND query_start < now() - interval '10 minutes';
```

### Emergency Vacuum

If autovacuum isn't keeping up:

```sql
-- Check vacuum progress
SELECT
  relid::regclass AS table,
  phase,
  heap_blks_total,
  heap_blks_scanned,
  round(100.0 * heap_blks_scanned / NULLIF(heap_blks_total, 0), 2) AS pct_complete
FROM pg_stat_progress_vacuum;

-- Manual vacuum with increased resources
SET maintenance_work_mem = '1GB';
VACUUM (VERBOSE, ANALYZE) <problem_table>;
```

## Monitoring Queries

### Health Dashboard Query

```sql
-- Comprehensive health check
SELECT
  'Database Size' as metric,
  pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT 'Active Connections', count(*)::text
FROM pg_stat_activity WHERE state = 'active'
UNION ALL
SELECT 'Idle Connections', count(*)::text
FROM pg_stat_activity WHERE state = 'idle'
UNION ALL
SELECT 'Cache Hit Ratio',
  round(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0), 2)::text || '%'
FROM pg_stat_database WHERE datname = current_database()
UNION ALL
SELECT 'Dead Tuples', sum(n_dead_tup)::text
FROM pg_stat_user_tables;
```

## Related Runbooks

- [Database Issues](../incidents/database-issues)
- [Database Migrations](../deployment/migrations)
- [Scaling Services](./scaling)
