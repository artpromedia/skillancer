# Service Down

Response guide for complete service outages.

**Last Verified**: 2024-01-25  
**Owner**: On-Call Team

## Overview

This runbook addresses complete service outages where a service is entirely unavailable. This is a P1 incident requiring immediate response.

## Severity: P1 - Critical

**Response Time**: < 15 minutes  
**Escalation**: Automatic after 15 minutes

## Initial Response (0-5 minutes)

### 1. Acknowledge the Alert

```bash
# Acknowledge in PagerDuty
pd incident acknowledge <incident-id>
```

### 2. Announce in #incidents

```
🚨 P1 INCIDENT: <service-name> is DOWN
- Time: [timestamp]
- Impact: [describe user impact]
- Investigating: @[your-name]
- Status: Investigating
```

### 3. Quick Assessment

```bash
# Check pod status
kubectl get pods -n production -l app=<service-name>

# Check recent events
kubectl get events -n production --field-selector involvedObject.name=<pod-name>

# Check service endpoint
kubectl get endpoints <service-name> -n production

# Quick health check
curl -v https://api.skillancer.com/<service>/health
```

## Diagnosis Decision Tree

```
Is the service responding at all?
│
├─ NO: Service completely unreachable
│   │
│   ├─ Pods running? → Check logs & restart
│   ├─ Pods crashed? → Check OOM, resources
│   ├─ No pods? → Check deployment
│   └─ Network issue? → Check ingress, LB
│
└─ YES but errors
    │
    ├─ 5xx errors → See High Error Rate runbook
    ├─ Timeouts → Check dependencies
    └─ Auth errors → Check secrets, tokens
```

## Common Causes and Fixes

### 1. All Pods Crashed

**Diagnosis:**

```bash
# Check pod status
kubectl get pods -n production -l app=<service>

# Look for CrashLoopBackOff or Error status
kubectl describe pod <pod-name> -n production

# Check recent logs
kubectl logs <pod-name> -n production --previous
```

**Resolution:**

```bash
# If recent deployment, rollback
kubectl rollout undo deployment/<service> -n production

# If resource issue, scale down then up
kubectl scale deployment/<service> -n production --replicas=0
kubectl scale deployment/<service> -n production --replicas=3

# If config issue, check configmaps/secrets
kubectl get configmap -n production | grep <service>
kubectl describe configmap <config-name> -n production
```

### 2. No Pods Scheduled

**Diagnosis:**

```bash
# Check deployment
kubectl get deployment <service> -n production

# Check replica count
kubectl describe deployment <service> -n production | grep Replicas

# Check for scheduling issues
kubectl get events -n production --sort-by='.lastTimestamp' | grep -i schedul
```

**Resolution:**

```bash
# Check node capacity
kubectl describe nodes | grep -A 5 "Allocated resources"

# If nodes full, scale cluster
# Or reduce resource requests
kubectl set resources deployment/<service> -n production \
  --requests=cpu=100m,memory=256Mi
```

### 3. Network/Load Balancer Issues

**Diagnosis:**

```bash
# Check service
kubectl get svc <service> -n production

# Check endpoints
kubectl get endpoints <service> -n production

# Check ingress
kubectl get ingress -n production
kubectl describe ingress <ingress-name> -n production

# Check AWS ALB (if applicable)
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>
```

**Resolution:**

```bash
# Restart kube-proxy (if DNS issues)
kubectl rollout restart daemonset/kube-proxy -n kube-system

# Force service recreation
kubectl delete svc <service> -n production
kubectl apply -f <service-manifest>
```

### 4. Database Dependency Down

**Diagnosis:**

```bash
# Check if DB is reachable from pod
kubectl exec -it <pod-name> -n production -- \
  nc -zv <db-host> 5432

# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier skillancer-production \
  --query 'DBInstances[0].DBInstanceStatus'
```

**Resolution:**

- If RDS is down, check AWS console
- If connection issue, check security groups
- See [Database Issues](./database-issues) runbook

### 5. Secret/Config Missing or Invalid

**Diagnosis:**

```bash
# Check if secrets exist
kubectl get secrets -n production | grep <service>

# Check secret is mounted
kubectl describe pod <pod-name> -n production | grep -A 10 Mounts

# Check for secret errors in events
kubectl get events -n production | grep -i secret
```

**Resolution:**

```bash
# Refresh secret from AWS Secrets Manager
# (if using external-secrets operator)
kubectl annotate externalsecret <secret-name> -n production \
  force-sync=$(date +%s)

# Or recreate secret manually
kubectl delete secret <secret-name> -n production
kubectl create secret generic <secret-name> -n production \
  --from-literal=key=value
```

### 6. Out of Memory (OOM)

**Diagnosis:**

```bash
# Check for OOMKilled
kubectl get pods -n production -o json | \
  jq '.items[] | select(.status.containerStatuses[].lastState.terminated.reason=="OOMKilled")'

# Check memory usage
kubectl top pods -n production -l app=<service>
```

**Resolution:**

```bash
# Increase memory limits
kubectl set resources deployment/<service> -n production \
  --limits=memory=1Gi \
  --requests=memory=512Mi

# Or scale out
kubectl scale deployment/<service> -n production --replicas=5
```

## Service-Specific Procedures

### User Service Down

Critical path - affects all authentication:

1. Check database connection
2. Check Redis (sessions)
3. Check JWT secret availability

```bash
# Quick check
kubectl logs -l app=user-service -n production --since=5m | grep -i error
```

### Payment Service Down

Financial impact - handle with extra care:

1. Enable maintenance mode immediately
2. Do NOT restart until transaction state is verified
3. Coordinate with finance team

```bash
# Check pending transactions
kubectl exec -it <pod> -n production -- npm run check:pending-transactions
```

### Project Service Down

Search/browse affected:

1. Check Elasticsearch connection
2. Check if search is the actual issue
3. Consider read replica failover

## Communication During Incident

### Update Every 15 Minutes

```
📊 INCIDENT UPDATE [HH:MM]
- Status: [Investigating/Identified/Fixing/Monitoring]
- Impact: [user-facing impact]
- Current action: [what you're doing]
- ETA: [if known, otherwise "Investigating"]
```

### Escalation Points

| Time    | Action                      |
| ------- | --------------------------- |
| 15 min  | Auto-page secondary         |
| 30 min  | Page engineering lead       |
| 1 hour  | Consider status page update |
| 2 hours | Executive notification      |

## Recovery Verification

After service is restored:

```bash
# 1. Health check
curl -s https://api.skillancer.com/<service>/health | jq .

# 2. Verify pods healthy
kubectl get pods -n production -l app=<service>

# 3. Check error rates (should be dropping)
# Monitor Grafana

# 4. Run smoke tests
pnpm test:smoke --env=production --service=<service>
```

## Post-Incident

1. **Update #incidents**

   ```
   ✅ INCIDENT RESOLVED
   - Duration: [X hours Y minutes]
   - Root cause: [brief]
   - Resolution: [what fixed it]
   - Post-mortem: [ticket link]
   ```

2. **Create incident ticket**
3. **Schedule post-mortem** (within 48 hours for P1)
4. **Update this runbook** if gaps found

## Related Runbooks

- [High Error Rate](./high-error-rate)
- [Database Issues](./database-issues)
- [Rollback Procedures](../deployment/rollback)
