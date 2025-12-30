# Scaling Runbook

This runbook covers scaling procedures for Skillancer infrastructure.

## Auto-Scaling Configuration

### API Services

```yaml
# Current auto-scaling configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

| Service          | Min Pods | Max Pods | CPU Target | Memory Target |
| ---------------- | -------- | -------- | ---------- | ------------- |
| api-gateway      | 3        | 50       | 70%        | 80%           |
| auth-svc         | 3        | 30       | 70%        | 80%           |
| market-svc       | 3        | 40       | 70%        | 80%           |
| skillpod-svc     | 2        | 25       | 60%        | 70%           |
| billing-svc      | 2        | 20       | 70%        | 80%           |
| notification-svc | 2        | 15       | 70%        | 80%           |

### Worker Services

```yaml
# Queue-based scaling
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker-scaler
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 2
  maxReplicaCount: 30
  triggers:
    - type: redis
      metadata:
        address: redis:6379
        listName: job-queue
        listLength: '1000'
```

| Worker              | Min Pods | Max Pods | Scale Trigger |
| ------------------- | -------- | -------- | ------------- |
| job-processor       | 2        | 30       | Queue > 1000  |
| email-sender        | 2        | 20       | Queue > 500   |
| notification-worker | 2        | 15       | Queue > 500   |

---

## Manual Scaling Procedures

### Scale API Service

```bash
# Scale immediately
kubectl scale deployment api-gateway --replicas=10 -n production

# Verify scaling
kubectl get pods -l app=api-gateway -n production

# Watch rollout
kubectl rollout status deployment/api-gateway -n production
```

### Scale All Services Proportionally

```bash
# Double all services
./scripts/scale-all.sh 2x

# Or specify exact replicas
./scripts/scale-all.sh --api=20 --auth=15 --market=15 --workers=10
```

### Scale Down Safely

```bash
# Check current load before scaling down
kubectl top pods -n production

# Scale down gradually
kubectl scale deployment api-gateway --replicas=8
sleep 300  # Wait 5 minutes
kubectl scale deployment api-gateway --replicas=5
sleep 300
kubectl scale deployment api-gateway --replicas=3
```

---

## Database Scaling

### Vertical Scaling (Instance Size)

**Note: Requires downtime (5-10 minutes)**

```bash
# Check current instance
aws rds describe-db-instances \
  --db-instance-identifier skillancer-production \
  --query 'DBInstances[0].DBInstanceClass'

# Scale up
aws rds modify-db-instance \
  --db-instance-identifier skillancer-production \
  --db-instance-class db.r6g.2xlarge \
  --apply-immediately

# Monitor modification
aws rds wait db-instance-available \
  --db-instance-identifier skillancer-production
```

| Instance Class | vCPU | Memory | Max Connections | Use Case       |
| -------------- | ---- | ------ | --------------- | -------------- |
| db.r6g.large   | 2    | 16 GB  | 1,000           | Development    |
| db.r6g.xlarge  | 4    | 32 GB  | 2,000           | Low traffic    |
| db.r6g.2xlarge | 8    | 64 GB  | 4,000           | Normal traffic |
| db.r6g.4xlarge | 16   | 128 GB | 8,000           | High traffic   |
| db.r6g.8xlarge | 32   | 256 GB | 16,000          | Peak events    |

### Horizontal Scaling (Read Replicas)

**Online operation - no downtime**

```bash
# Add read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier skillancer-replica-2 \
  --source-db-instance-identifier skillancer-production \
  --db-instance-class db.r6g.xlarge

# Wait for replica
aws rds wait db-instance-available \
  --db-instance-identifier skillancer-replica-2

# Add to load balancer
kubectl apply -f k8s/database/replica-endpoint.yaml
```

```bash
# Remove read replica
kubectl delete -f k8s/database/replica-endpoint.yaml

aws rds delete-db-instance \
  --db-instance-identifier skillancer-replica-2 \
  --skip-final-snapshot
```

### Connection Pool Scaling

```bash
# Update PgBouncer pool size
kubectl edit configmap pgbouncer-config -n production

# Restart PgBouncer
kubectl rollout restart deployment/pgbouncer -n production
```

---

## Redis Scaling

### Add Redis Nodes (Cluster Mode)

```bash
# Add shards to ElastiCache
aws elasticache modify-replication-group-shard-configuration \
  --replication-group-id skillancer-redis \
  --node-group-count 4 \
  --apply-immediately

# Monitor resharding
aws elasticache describe-replication-groups \
  --replication-group-id skillancer-redis \
  --query 'ReplicationGroups[0].Status'
```

### Increase Redis Memory

```bash
# Scale up node type
aws elasticache modify-replication-group \
  --replication-group-id skillancer-redis \
  --cache-node-type cache.r6g.xlarge \
  --apply-immediately
```

---

## CDN Configuration

### CloudFront Settings

| Content Type  | TTL    | Cache Headers          |
| ------------- | ------ | ---------------------- |
| Static assets | 1 year | immutable              |
| Images        | 7 days | stale-while-revalidate |
| API responses | 0      | no-cache               |
| HTML pages    | 1 hour | stale-while-revalidate |

### Increase Origin Request Limit

```bash
# Update Lambda@Edge for rate limiting
aws lambda update-function-configuration \
  --function-name skillancer-edge-ratelimit \
  --environment "Variables={RATE_LIMIT=10000}"
```

### Add CloudFront Origin Shield

```bash
# Enable origin shield for reduced origin load
aws cloudfront update-distribution \
  --id $CF_DISTRIBUTION_ID \
  --distribution-config file://cf-config-with-shield.json
```

---

## Event-Based Scaling

### Preparing for Traffic Spikes

**Before known high-traffic events:**

```bash
# 1. Pre-scale services
kubectl scale deployment api-gateway --replicas=15
kubectl scale deployment market-svc --replicas=12
kubectl scale deployment auth-svc --replicas=10

# 2. Warm up database connections
./scripts/warm-connections.sh

# 3. Pre-populate cache
./scripts/warm-cache.sh

# 4. Increase rate limits
kubectl set env deployment/api-gateway RATE_LIMIT_MULTIPLIER=2
```

### Post-Event Scale Down

```bash
# 1. Monitor traffic returning to normal
# Check grafana dashboard for 1 hour

# 2. Gradually reduce replicas
kubectl scale deployment api-gateway --replicas=10
sleep 1800  # 30 minutes
kubectl scale deployment api-gateway --replicas=5
sleep 1800
kubectl scale deployment api-gateway --replicas=3

# 3. Reset rate limits
kubectl set env deployment/api-gateway RATE_LIMIT_MULTIPLIER=1
```

---

## Scaling Alerts

### Alert Thresholds

| Metric               | Warning | Critical | Action              |
| -------------------- | ------- | -------- | ------------------- |
| CPU > 80%            | 5 min   | 2 min    | Scale up            |
| Memory > 85%         | 5 min   | 2 min    | Scale up            |
| Pods pending         | 1 pod   | 3 pods   | Check node capacity |
| Queue depth > 5000   | -       | 1 min    | Scale workers       |
| DB connections > 80% | 5 min   | 2 min    | Scale pool          |

### Responding to Alerts

```bash
# Check what's causing high CPU
kubectl top pods -n production --sort-by=cpu

# Check node capacity
kubectl describe nodes | grep -A5 "Allocated resources"

# Add nodes if needed
eksctl scale nodegroup \
  --cluster skillancer \
  --name production-workers \
  --nodes 10
```

---

## Capacity Planning

### Current Capacity

| Resource       | Current | Peak Usage | Headroom |
| -------------- | ------- | ---------- | -------- |
| API Pods       | 5       | 3 avg      | 40%      |
| DB Connections | 2000    | 800 peak   | 60%      |
| Redis Memory   | 8 GB    | 4 GB       | 50%      |
| Storage        | 200 GB  | 120 GB     | 40%      |

### Growth Projections

| Metric       | Current | 6 Month | 12 Month |
| ------------ | ------- | ------- | -------- |
| Users        | 10k     | 50k     | 200k     |
| Jobs/day     | 500     | 2,500   | 10,000   |
| Requests/sec | 100     | 500     | 2,000    |

### Infrastructure Requirements

Based on projections:

| Timeframe | Database                  | Redis               | API Pods |
| --------- | ------------------------- | ------------------- | -------- |
| Now       | db.r6g.xlarge             | r6g.large           | 3-10     |
| 6 months  | db.r6g.2xlarge            | r6g.xlarge          | 10-25    |
| 12 months | db.r6g.4xlarge + replicas | r6g.2xlarge cluster | 25-50    |

---

## Runbook Updates

Last updated: 2024-01
Next review: 2024-04

Changes to scaling configuration should be:

1. Tested in staging
2. Documented in this runbook
3. Reviewed by infrastructure team
