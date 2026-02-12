# High Error Rate

Response guide when error rates exceed normal thresholds.

**Last Verified**: 2024-01-25  
**Owner**: On-Call Team

## Overview

This runbook addresses situations where error rates spike above acceptable thresholds. Normal error rate is < 0.1%. Alert triggers at > 1%.

## Alert Thresholds

| Severity  | Error Rate | Duration | Action             |
| --------- | ---------- | -------- | ------------------ |
| Warning   | > 0.5%     | 2 min    | Monitor            |
| Critical  | > 1%       | 2 min    | Investigate        |
| Emergency | > 5%       | 1 min    | Immediate response |

## Initial Assessment (< 5 minutes)

### 1. Identify Scope

```bash
# Check which service(s) affected
kubectl get pods -n production | grep -v Running

# Check error rates per service
curl -s "https://grafana.skillancer.com/api/dashboards/uid/errors" \
  | jq '.dashboard.panels[].targets[].expr'
```

### 2. Check Recent Changes

```bash
# Recent deployments
kubectl rollout history deployment -n production

# Recent config changes
kubectl get configmaps -n production -o yaml | grep -i "last-applied"

# GitHub recent merges
gh pr list --state merged --limit 5
```

### 3. Quick Health Check

```bash
# Check all service health
for svc in user project booking payment notification; do
  echo "=== $svc ==="
  curl -s https://api.skillancer.com/$svc/health | jq '.'
done
```

## Diagnosis

### Check Logs for Error Patterns

```bash
# Stream error logs
kubectl logs -l app=<service> -n production --since=10m | grep -i error

# Count errors by type
kubectl logs -l app=<service> -n production --since=10m \
  | grep -i error \
  | sort | uniq -c | sort -rn | head -20
```

### Common Error Categories

#### 1. Downstream Service Errors (5xx from dependencies)

**Symptoms:**

- Errors mention other service names
- Network timeout errors
- Connection refused errors

**Actions:**

```bash
# Check downstream service health
curl -s https://api.skillancer.com/<downstream>/health

# Check network policies
kubectl get networkpolicies -n production
```

#### 2. Database Errors

**Symptoms:**

- "Connection refused" or "Too many connections"
- Query timeout errors
- Deadlock errors

**Actions:**

```bash
# Check database connections
psql $DATABASE_URL -c "
  SELECT count(*), state
  FROM pg_stat_activity
  GROUP BY state;
"

# Check for long-running queries
psql $DATABASE_URL -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY duration DESC
  LIMIT 10;
"
```

See [Database Issues](./database-issues) for more details.

#### 3. Resource Exhaustion

**Symptoms:**

- OOMKilled pods
- High CPU/memory in metrics
- Slow response times

**Actions:**

```bash
# Check pod resource usage
kubectl top pods -n production

# Check for OOMKilled
kubectl get pods -n production -o json | \
  jq '.items[] | select(.status.containerStatuses[].lastState.terminated.reason=="OOMKilled") | .metadata.name'

# Check node resources
kubectl top nodes
```

#### 4. Bad Deployment

**Symptoms:**

- Errors started after recent deployment
- New pods are unhealthy
- Version mismatch

**Actions:**

```bash
# Check recent rollouts
kubectl rollout history deployment/<service> -n production

# If recent deployment, rollback
kubectl rollout undo deployment/<service> -n production
```

## Resolution Actions

### If Recent Deployment Caused Issue

```bash
# Immediate rollback
kubectl rollout undo deployment/<service> -n production

# Wait for rollout
kubectl rollout status deployment/<service> -n production

# Verify error rate dropping
# Monitor Grafana dashboard
```

### If External Dependency Down

1. Check status page of dependency
2. Enable circuit breaker if available
3. Consider failing open vs closed
4. Communicate to users if user-facing

```bash
# Enable maintenance mode if needed
kubectl set env deployment/<service> MAINTENANCE_MODE=true -n production
```

### If Resource Exhaustion

```bash
# Scale up temporarily
kubectl scale deployment/<service> -n production --replicas=<N+2>

# Or increase resources (requires deployment)
kubectl set resources deployment/<service> -n production \
  --limits=cpu=1000m,memory=1Gi \
  --requests=cpu=500m,memory=512Mi
```

### If Database Issues

See [Database Issues](./database-issues) runbook.

## Verification

After taking action:

```bash
# 1. Monitor error rate (should decrease within 5 min)
watch -n 5 'curl -s https://api.skillancer.com/<service>/metrics | grep error_rate'

# 2. Check health endpoint
curl -s https://api.skillancer.com/<service>/health

# 3. Verify in Grafana
# Error rate should return to < 0.1%
```

## Escalation

Escalate if:

- Error rate not improving after 15 minutes
- Root cause not identified after 30 minutes
- Multiple services affected
- Data integrity concerns

```bash
# Page secondary on-call
pd trigger -s "High error rate - need assistance"

# Or escalate to engineering lead
# Chat: @eng-lead in #incidents
```

## Post-Incident

1. Update #incidents with resolution
2. Create incident ticket
3. Document:
   - Timeline
   - Root cause
   - Actions taken
   - Prevention measures
4. Schedule post-mortem for P1/P2

## Related Runbooks

- [Rollback Procedures](../deployment/rollback)
- [Database Issues](./database-issues)
- [Service Down](./service-down)
