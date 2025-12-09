# Database Infrastructure Guide

This document covers the RDS PostgreSQL and ElastiCache Redis infrastructure for Skillancer.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VPC (10.0.0.0/16)                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        Private Database Subnets                          │ │
│  │                                                                          │ │
│  │   ┌─────────────────────┐        ┌─────────────────────┐                │ │
│  │   │   AZ-A (10.0.48.0)  │        │   AZ-B (10.0.49.0)  │                │ │
│  │   │                     │        │                     │                │ │
│  │   │  ┌──────────────┐   │        │  ┌──────────────┐   │                │ │
│  │   │  │ RDS Primary  │◄──┼────────┼──│ RDS Standby  │   │                │ │
│  │   │  │ (Multi-AZ)   │   │        │  │ (Multi-AZ)   │   │                │ │
│  │   │  └──────────────┘   │        │  └──────────────┘   │                │ │
│  │   │         │           │        │                     │                │ │
│  │   │         ▼           │        │                     │                │ │
│  │   │  ┌──────────────┐   │        │  ┌──────────────┐   │                │ │
│  │   │  │ Read Replica │   │        │  │ Redis Replica│   │                │ │
│  │   │  │ (Optional)   │   │        │  │    (HA)      │   │                │ │
│  │   │  └──────────────┘   │        │  └──────────────┘   │                │ │
│  │   │                     │        │         │           │                │ │
│  │   │  ┌──────────────┐   │        │         ▼           │                │ │
│  │   │  │ Redis Primary│◄──┼────────┼──┌──────────────┐   │                │ │
│  │   │  │    (HA)      │   │        │  │ Redis Replica│   │                │ │
│  │   │  └──────────────┘   │        │  │    (HA)      │   │                │ │
│  │   │                     │        │  └──────────────┘   │                │ │
│  │   └─────────────────────┘        └─────────────────────┘                │ │
│  │                                                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Private Application Subnets                      │ │
│  │                                                                          │ │
│  │   ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │   │                    ECS Fargate Services                           │  │ │
│  │   │                                                                   │  │ │
│  │   │   [API Service]   [Worker Service]   [Scheduler Service]         │  │ │
│  │   │         │                │                    │                   │  │ │
│  │   │         └────────────────┴────────────────────┘                   │  │ │
│  │   │                          │                                        │  │ │
│  │   │                          ▼                                        │  │ │
│  │   │            Security Group: Allow 5432, 6379                       │  │ │
│  │   └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### RDS PostgreSQL

| Feature              | Development   | Staging      | Production   |
| -------------------- | ------------- | ------------ | ------------ |
| Instance             | db.t3.micro   | db.t3.medium | db.r6g.large |
| Storage              | 20GB (gp3)    | 50GB (gp3)   | 100GB+ (gp3) |
| Multi-AZ             | No            | Yes          | Yes          |
| Read Replicas        | 0             | 0            | 1+           |
| Backup Retention     | 1 day         | 7 days       | 30 days      |
| Performance Insights | 7 days (free) | 7 days       | 2 years      |
| Encryption           | Yes           | Yes          | Yes          |

### ElastiCache Redis

| Feature                 | Development    | Staging        | Production      |
| ----------------------- | -------------- | -------------- | --------------- |
| Node Type               | cache.t3.micro | cache.t3.small | cache.r6g.large |
| Nodes                   | 1              | 2              | 3+              |
| Automatic Failover      | No             | Yes            | Yes             |
| Multi-AZ                | No             | Yes            | Yes             |
| Snapshot Retention      | 1 day          | 7 days         | 30 days         |
| Encryption (at-rest)    | Yes            | Yes            | Yes             |
| Encryption (in-transit) | Yes            | Yes            | Yes             |

## Quick Start

### Deploy Development Environment

```hcl
# environments/dev/main.tf

module "rds" {
  source = "../../modules/rds"

  project     = "skillancer"
  environment = "dev"

  vpc_id                     = module.networking.vpc_id
  subnet_ids                 = module.networking.database_subnet_ids
  allowed_security_group_ids = [module.ecs_cluster.service_security_group_id]

  instance_class    = "db.t3.micro"
  allocated_storage = 20

  multi_az            = false
  create_read_replica = false

  deletion_protection     = false
  backup_retention_period = 1
  skip_final_snapshot     = true
}

module "elasticache" {
  source = "../../modules/elasticache"

  project     = "skillancer"
  environment = "dev"

  vpc_id                     = module.networking.vpc_id
  subnet_ids                 = module.networking.database_subnet_ids
  allowed_security_group_ids = [module.ecs_cluster.service_security_group_id]

  node_type          = "cache.t3.micro"
  num_cache_clusters = 1

  automatic_failover_enabled = false
  multi_az_enabled           = false
}
```

### Deploy Production Environment

```hcl
# environments/prod/main.tf

module "rds" {
  source = "../../modules/rds"

  project     = "skillancer"
  environment = "prod"

  vpc_id                     = module.networking.vpc_id
  subnet_ids                 = module.networking.database_subnet_ids
  allowed_security_group_ids = [module.ecs_cluster.service_security_group_id]
  kms_key_id                 = module.kms.key_arn

  instance_class        = "db.r6g.large"
  allocated_storage     = 100
  max_allocated_storage = 500

  multi_az               = true
  create_read_replica    = true
  read_replica_count     = 1
  replica_instance_class = "db.r6g.large"

  deletion_protection     = true
  backup_retention_period = 30

  enable_cloudwatch_alarms = true
  alarm_sns_topic_arn      = module.monitoring.alerts_topic_arn
}

module "elasticache" {
  source = "../../modules/elasticache"

  project     = "skillancer"
  environment = "prod"

  vpc_id                     = module.networking.vpc_id
  subnet_ids                 = module.networking.database_subnet_ids
  allowed_security_group_ids = [module.ecs_cluster.service_security_group_id]
  kms_key_id                 = module.kms.key_arn

  node_type          = "cache.r6g.large"
  num_cache_clusters = 3

  automatic_failover_enabled = true
  multi_az_enabled           = true

  enable_cloudwatch_alarms = true
  alarm_sns_topic_arn      = module.monitoring.alerts_topic_arn
}
```

## Connection Strings

### Application Configuration

Credentials are stored in AWS Secrets Manager. Retrieve them in your application:

```typescript
// Using AWS SDK v3
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

// RDS credentials
const rdsSecret = await client.send(
  new GetSecretValueCommand({ SecretId: 'skillancer/prod/rds/credentials' })
);
const rds = JSON.parse(rdsSecret.SecretString!);
const databaseUrl = `postgresql://${rds.username}:${rds.password}@${rds.host}:${rds.port}/${rds.dbname}`;

// Redis credentials
const redisSecret = await client.send(
  new GetSecretValueCommand({ SecretId: 'skillancer/prod/redis/auth-token' })
);
const redis = JSON.parse(redisSecret.SecretString!);
const redisUrl = `rediss://:${redis.auth_token}@${redis.primary_endpoint}:${redis.port}`;
```

### ECS Task Definition

```json
{
  "containerDefinitions": [
    {
      "name": "api",
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:skillancer/prod/rds/credentials"
        },
        {
          "name": "REDIS_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:skillancer/prod/redis/auth-token"
        }
      ]
    }
  ]
}
```

## Backup & Recovery

### Automated Backups

| Environment | RDS Backup Window | Redis Snapshot Window | Retention |
| ----------- | ----------------- | --------------------- | --------- |
| Development | 03:00-04:00 UTC   | N/A                   | 1 day     |
| Staging     | 03:00-04:00 UTC   | 04:00-05:00 UTC       | 7 days    |
| Production  | 03:00-04:00 UTC   | 04:00-05:00 UTC       | 30 days   |

### Manual Snapshot

```bash
# RDS manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier skillancer-prod \
  --db-snapshot-identifier skillancer-prod-manual-$(date +%Y%m%d)

# Redis manual snapshot
aws elasticache create-snapshot \
  --replication-group-id skillancer-prod \
  --snapshot-name skillancer-prod-redis-manual-$(date +%Y%m%d)
```

### Point-in-Time Recovery (RDS)

```bash
# Restore to a specific point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier skillancer-prod \
  --target-db-instance-identifier skillancer-prod-restored \
  --restore-time "2024-01-15T10:00:00Z"
```

### Restore from Snapshot

```bash
# RDS restore
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier skillancer-prod-restored \
  --db-snapshot-identifier skillancer-prod-manual-20240115

# Redis restore
aws elasticache create-replication-group \
  --replication-group-id skillancer-prod-restored \
  --replication-group-description "Restored from snapshot" \
  --snapshot-name skillancer-prod-redis-manual-20240115
```

## Disaster Recovery

### RDS Multi-AZ Failover

Multi-AZ deployments automatically failover to the standby:

1. **Automatic Failover Triggers:**
   - Primary instance failure
   - AZ outage
   - Instance type change
   - Software patching
   - Manual failover

2. **Failover Time:** 60-120 seconds typically

3. **Manual Failover (Testing):**
   ```bash
   aws rds reboot-db-instance \
     --db-instance-identifier skillancer-prod \
     --force-failover
   ```

### Redis Failover

```bash
# Test failover
aws elasticache test-failover \
  --replication-group-id skillancer-prod \
  --node-group-id 0001
```

### Cross-Region Disaster Recovery

For cross-region DR, consider:

1. **RDS Cross-Region Read Replica:**

   ```hcl
   resource "aws_db_instance" "dr_replica" {
     provider = aws.dr_region

     identifier          = "skillancer-prod-dr"
     replicate_source_db = aws_db_instance.main.arn
     instance_class      = "db.r6g.large"

     # In disaster, promote to primary
   }
   ```

2. **ElastiCache Global Datastore:**
   ```hcl
   resource "aws_elasticache_global_replication_group" "main" {
     global_replication_group_id_suffix = "skillancer"
     primary_replication_group_id       = aws_elasticache_replication_group.main.id
   }
   ```

## Monitoring & Alerting

### CloudWatch Alarms

The modules create the following alarms:

#### RDS Alarms

| Alarm                | Threshold | Description          |
| -------------------- | --------- | -------------------- |
| CPU Utilization      | > 80%     | High CPU usage       |
| Free Storage         | < 20%     | Low disk space       |
| Database Connections | > 160     | Too many connections |
| Freeable Memory      | < 256MB   | Low memory           |
| Read Latency         | > 20ms    | Slow reads           |
| Write Latency        | > 50ms    | Slow writes          |
| Replica Lag          | > 60s     | Replication delay    |

#### Redis Alarms

| Alarm               | Threshold   | Description          |
| ------------------- | ----------- | -------------------- |
| CPU Utilization     | > 80%       | High CPU usage       |
| Memory Usage        | > 80%       | High memory usage    |
| Current Connections | > 5000      | Too many connections |
| Evictions           | > 1000/5min | High eviction rate   |
| Cache Hit Rate      | < 80%       | Low cache efficiency |
| Replication Lag     | > 1s        | Replication delay    |

### Key Metrics Dashboard

```sql
-- RDS Performance Insights: Top SQL by execution time
SELECT
  digest_text,
  sum_timer_wait / 1000000000 as total_seconds,
  count_star as executions,
  avg_timer_wait / 1000000 as avg_ms
FROM performance_schema.events_statements_summary_by_digest
ORDER BY sum_timer_wait DESC
LIMIT 10;
```

### Redis Monitoring Commands

```bash
# Connect to Redis
redis-cli -h your-redis-endpoint -p 6379 --tls --askpass

# Check memory usage
INFO memory

# Check connected clients
INFO clients

# Check replication status
INFO replication

# Slow log
SLOWLOG GET 10
```

## Performance Tuning

### PostgreSQL Parameters

Production-recommended parameters (set via `parameters` variable):

```hcl
parameters = [
  # Memory
  { name = "shared_buffers", value = "{DBInstanceClassMemory/4}" },
  { name = "effective_cache_size", value = "{DBInstanceClassMemory*3/4}" },
  { name = "work_mem", value = "65536" },
  { name = "maintenance_work_mem", value = "524288" },

  # Checkpoints
  { name = "checkpoint_completion_target", value = "0.9" },
  { name = "wal_buffers", value = "16384" },

  # Planner
  { name = "random_page_cost", value = "1.1" },  # SSD
  { name = "effective_io_concurrency", value = "200" },

  # Connections
  { name = "max_connections", value = "200" },
]
```

### Redis Parameters

```hcl
parameters = [
  { name = "maxmemory-policy", value = "volatile-lru" },
  { name = "timeout", value = "300" },
  { name = "tcp-keepalive", value = "300" },
  { name = "notify-keyspace-events", value = "AKE" },
]
```

## Security

### Encryption

| Layer       | RDS             | Redis           |
| ----------- | --------------- | --------------- |
| At Rest     | KMS (AES-256)   | KMS (AES-256)   |
| In Transit  | SSL/TLS         | TLS             |
| Credentials | Secrets Manager | Secrets Manager |

### Network Security

- Database subnets have no internet access
- Security groups restrict access to ECS services only
- No public IP addresses assigned
- VPC endpoints for AWS services

### Access Control

```sql
-- Create application user (not master)
CREATE USER skillancer_app WITH PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE skillancer TO skillancer_app;
GRANT USAGE ON SCHEMA public TO skillancer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO skillancer_app;

-- Read-only user for analytics
CREATE USER skillancer_readonly WITH PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE skillancer TO skillancer_readonly;
GRANT USAGE ON SCHEMA public TO skillancer_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO skillancer_readonly;
```

## Cost Optimization

### Right-Sizing

Monitor these metrics to identify over-provisioning:

- **CPU Utilization**: If consistently < 20%, consider smaller instance
- **Freeable Memory**: If consistently > 50% free, consider smaller instance
- **Storage**: Use auto-scaling to avoid over-provisioning

### Reserved Instances

For production workloads running 24/7:

| Instance        | On-Demand | 1-Year RI | 3-Year RI | Savings |
| --------------- | --------- | --------- | --------- | ------- |
| db.r6g.large    | $190/mo   | $120/mo   | $85/mo    | 37-55%  |
| cache.r6g.large | $130/mo   | $85/mo    | $55/mo    | 35-58%  |

### Graviton Instances

Use Graviton (r6g, t4g) instances for:

- Up to 40% better price/performance
- Same functionality as x86 instances

## Troubleshooting

### Common Issues

#### Connection Refused

```bash
# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxx

# Verify subnet routing
aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=subnet-xxx"
```

#### High Connection Count

```sql
-- View active connections
SELECT
  usename,
  application_name,
  client_addr,
  state,
  count(*)
FROM pg_stat_activity
GROUP BY usename, application_name, client_addr, state;

-- Terminate idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '1 hour';
```

#### Slow Queries

```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT
  query,
  calls,
  total_exec_time / calls as avg_time_ms,
  rows / calls as avg_rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

#### Redis Memory Issues

```bash
# Check memory info
redis-cli INFO memory

# Find big keys
redis-cli --bigkeys

# Memory analysis
redis-cli MEMORY DOCTOR
```

## Maintenance Windows

| Environment | RDS Window          | Redis Window        |
| ----------- | ------------------- | ------------------- |
| Development | Any time            | Any time            |
| Staging     | Mon 04:00-05:00 UTC | Sun 05:00-06:00 UTC |
| Production  | Mon 04:00-05:00 UTC | Sun 05:00-06:00 UTC |

### Maintenance Notifications

Subscribe to RDS and ElastiCache events:

```hcl
resource "aws_db_event_subscription" "main" {
  name      = "${var.project}-${var.environment}-rds-events"
  sns_topic = aws_sns_topic.alerts.arn

  source_type = "db-instance"
  source_ids  = [aws_db_instance.main.id]

  event_categories = [
    "availability",
    "deletion",
    "failover",
    "failure",
    "maintenance",
    "recovery",
  ]
}
```

## References

- [RDS PostgreSQL Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [ElastiCache Redis Documentation](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/WhatIs.html)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [ElastiCache Best Practices](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html)
