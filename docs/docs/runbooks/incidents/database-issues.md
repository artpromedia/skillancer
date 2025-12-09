# Database Issues

Response guide for database-related incidents and performance problems.

**Last Verified**: 2024-01-25  
**Owner**: DevOps Team

## Overview

This runbook covers diagnosis and resolution of PostgreSQL database issues including connection problems, slow queries, replication lag, and disk space issues.

## Alert Types

| Alert                     | Threshold  | Severity | Response    |
| ------------------------- | ---------- | -------- | ----------- |
| High Connections          | > 80% max  | Warning  | Monitor     |
| Connection Pool Exhausted | > 95% max  | Critical | Immediate   |
| Slow Queries              | P99 > 5s   | Warning  | Investigate |
| Replication Lag           | > 30s      | Critical | Investigate |
| Disk Space Low            | < 20% free | Warning  | Plan action |
| Disk Space Critical       | < 10% free | Critical | Immediate   |

## Quick Diagnosis

```bash
# Connect to database
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id skillancer/production/database \
  --query SecretString --output text | jq -r '.url')

# Quick health check
psql $DATABASE_URL -c "
  SELECT
    numbackends as connections,
    xact_commit as commits,
    xact_rollback as rollbacks,
    blks_hit * 100.0 / (blks_hit + blks_read) as cache_hit_ratio
  FROM pg_stat_database
  WHERE datname = current_database();
"
```

## Connection Issues

### Too Many Connections

**Symptoms:**

- "too many connections" errors
- New connections timing out
- Services unable to connect

**Diagnosis:**

```sql
-- Check connection count and state
SELECT count(*), state, usename, application_name
FROM pg_stat_activity
GROUP BY state, usename, application_name
ORDER BY count(*) DESC;

-- Check connection limit
SHOW max_connections;

-- Check connections by client
SELECT client_addr, count(*)
FROM pg_stat_activity
WHERE client_addr IS NOT NULL
GROUP BY client_addr
ORDER BY count(*) DESC;
```

**Resolution:**

```sql
-- Terminate idle connections (older than 10 minutes)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < now() - interval '10 minutes'
  AND usename != 'postgres';

-- Terminate specific problematic connection
SELECT pg_terminate_backend(<pid>);
```

**Prevention:**

- Check application connection pool settings
- Ensure connections are properly closed
- Consider PgBouncer for connection pooling

### Connection Refused

**Symptoms:**

- "Connection refused" errors
- Database appears down

**Diagnosis:**

```bash
# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier skillancer-production \
  --query 'DBInstances[0].DBInstanceStatus'

# Check security group
aws ec2 describe-security-groups \
  --group-ids <sg-id> \
  --query 'SecurityGroups[0].IpPermissions'
```

**Resolution:**

- If RDS restarting, wait for it to come online
- Check VPC/security group configuration
- Verify database endpoint DNS resolution

## Slow Queries

### Identify Slow Queries

```sql
-- Currently running queries (> 5 seconds)
SELECT
  pid,
  now() - query_start AS duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;

-- Historical slow queries (if pg_stat_statements enabled)
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_time_ms,
  round(mean_exec_time::numeric, 2) AS mean_time_ms,
  query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Analyze Query Performance

```sql
-- Explain specific query
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
<your_query_here>;

-- Check table statistics
SELECT
  schemaname,
  relname,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;
```

### Resolution for Slow Queries

```sql
-- Kill long-running query
SELECT pg_cancel_backend(<pid>);  -- Graceful
SELECT pg_terminate_backend(<pid>);  -- Force

-- Update statistics
ANALYZE <table_name>;

-- Check for missing indexes
SELECT
  schemaname,
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / NULLIF(idx_scan, 0) AS ratio
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC
LIMIT 20;
```

## Lock Issues

### Detect Locks

```sql
-- View current locks
SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query,
  blocked.wait_event_type
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.pid != blocking.pid;

-- View lock details
SELECT
  locktype,
  relation::regclass,
  mode,
  granted,
  pid
FROM pg_locks
WHERE NOT granted;
```

### Resolve Deadlocks

```sql
-- Identify deadlock participants
SELECT * FROM pg_stat_activity
WHERE pid IN (
  SELECT pid FROM pg_locks WHERE NOT granted
);

-- Terminate one side of deadlock (choose carefully)
SELECT pg_terminate_backend(<pid>);
```

## Disk Space Issues

### Check Disk Usage

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Table sizes
SELECT
  relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_indexes_size(relid)) AS indexes_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- Index sizes
SELECT
  indexrelname AS index,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
```

### Free Up Space

```sql
-- Remove dead tuples (be careful with timing)
VACUUM (VERBOSE, ANALYZE) <table_name>;

-- Full vacuum (requires lock, more aggressive)
VACUUM FULL <table_name>;

-- Reindex bloated indexes
REINDEX INDEX CONCURRENTLY <index_name>;

-- Delete old data (if applicable)
DELETE FROM logs WHERE created_at < now() - interval '90 days';
VACUUM logs;
```

### AWS RDS Specifics

```bash
# Check storage
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=skillancer-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average

# Increase storage (if needed)
aws rds modify-db-instance \
  --db-instance-identifier skillancer-production \
  --allocated-storage <new_size_gb> \
  --apply-immediately
```

## Replication Issues

### Check Replication Status

```sql
-- On primary (for streaming replication)
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;
```

### AWS RDS Read Replica Lag

```bash
# Check replica lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name ReplicaLag \
  --dimensions Name=DBInstanceIdentifier,Value=skillancer-production-replica \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 \
  --statistics Average
```

## Emergency Procedures

### Failover to Read Replica

If primary is unrecoverable:

```bash
# Promote read replica (RDS)
aws rds promote-read-replica \
  --db-instance-identifier skillancer-production-replica

# Update application connection strings
# This requires deployment or config change
```

### Restore from Snapshot

```bash
# List recent snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier skillancer-production \
  --query 'DBSnapshots[0:5].{ID:DBSnapshotIdentifier,Time:SnapshotCreateTime}'

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier skillancer-recovery \
  --db-snapshot-identifier <snapshot-id>
```

## Verification

After resolution:

1. ✅ Connection count normalized
2. ✅ Query latencies normal
3. ✅ No blocking locks
4. ✅ Disk space adequate
5. ✅ Application health checks passing
6. ✅ Error rates back to baseline

## Related Runbooks

- [High Error Rate](./high-error-rate)
- [Database Migrations](../deployment/migrations)
- [Database Maintenance](../maintenance/database)
