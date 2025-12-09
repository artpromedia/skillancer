# Rollback Procedures

How to rollback a problematic deployment quickly and safely.

**Last Verified**: 2024-01-25  
**Owner**: DevOps Team

## Overview

When a deployment causes issues in production, quick rollback is essential. This guide covers different rollback scenarios and procedures.

## When to Rollback

Initiate rollback when ANY of these conditions occur:

- ❌ Error rate > 1% for 5+ minutes
- ❌ P99 latency > 2x normal for 5+ minutes
- ❌ Health checks failing
- ❌ Critical user flows broken
- ❌ Data corruption detected
- ❌ Security vulnerability exposed

## Quick Rollback (< 2 minutes)

### Kubernetes Rollback

```bash
# Immediate rollback to previous version
kubectl rollout undo deployment/<service-name> -n production

# Verify rollback
kubectl rollout status deployment/<service-name> -n production

# Check current image
kubectl describe deployment/<service-name> -n production | grep Image
```

### Rollback to Specific Version

```bash
# List rollout history
kubectl rollout history deployment/<service-name> -n production

# Rollback to specific revision
kubectl rollout undo deployment/<service-name> -n production --to-revision=<N>
```

## Detailed Rollback Procedure

### Step 1: Acknowledge the Issue

1. Post in #incidents channel:

   ```
   🚨 INCIDENT: Rolling back <service> due to <brief reason>
   - Initiated by: @yourname
   - Time: <timestamp>
   ```

2. If outside business hours, page on-call:
   ```bash
   # Via PagerDuty CLI
   pd trigger -s "<service> rollback in progress"
   ```

### Step 2: Execute Rollback

```bash
# 1. Pause any ongoing deployments
kubectl rollout pause deployment/<service-name> -n production

# 2. Rollback to previous version
kubectl rollout undo deployment/<service-name> -n production

# 3. Monitor rollback progress
kubectl rollout status deployment/<service-name> -n production

# 4. Verify pods are running
kubectl get pods -n production -l app=<service-name>
```

### Step 3: Verify Rollback Success

```bash
# Check health endpoint
curl -s https://api.skillancer.com/<service>/health | jq .

# Verify version
curl -s https://api.skillancer.com/<service>/health | jq '.version'

# Check error rate in Grafana
# Should see immediate improvement
```

### Step 4: Post-Rollback

1. Update #incidents:

   ```
   ✅ Rollback complete: <service> reverted to v<previous-version>
   - Error rate: <normalizing/normalized>
   - All health checks: passing
   - Investigating root cause
   ```

2. Create incident ticket
3. Begin root cause investigation

## Database-Related Rollbacks

:::danger
If the failed deployment included database migrations, additional steps are required. **DO NOT** rollback Kubernetes until database is handled.
:::

### Check for Migration Issues

```bash
# Check migration status
pnpm prisma migrate status

# Review recent migrations
ls -la prisma/migrations/
```

### Rollback with Migrations

See [Database Migrations Runbook](./migrations) for:

1. Creating down migrations
2. Reverting database changes
3. Data recovery procedures

## Feature Flag Rollback

If using feature flags, disable the flag first:

```bash
# Via LaunchDarkly CLI
ld flags update <flag-key> --env production --off

# Or via admin API
curl -X PATCH https://api.skillancer.com/admin/features/<flag> \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false}'
```

## Traffic-Based Rollback

For gradual rollouts, reduce traffic immediately:

```bash
# If using Istio
kubectl patch virtualservice <service> -n production \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/http/0/route/0/weight", "value": 100}]'

# This sends 100% traffic to the stable version
```

## Verification Checklist

After rollback, verify:

- [ ] Health endpoint returns 200
- [ ] Version matches expected previous version
- [ ] Error rate returned to baseline (< 0.1%)
- [ ] P99 latency returned to baseline
- [ ] Critical user flows working
- [ ] No error spikes in logs
- [ ] Monitoring alerts resolved

```bash
# Quick verification script
#!/bin/bash
SERVICE=$1
EXPECTED_VERSION=$2

# Check health
HEALTH=$(curl -s https://api.skillancer.com/$SERVICE/health)
VERSION=$(echo $HEALTH | jq -r '.version')

if [ "$VERSION" = "$EXPECTED_VERSION" ]; then
  echo "✅ Version correct: $VERSION"
else
  echo "❌ Version mismatch: got $VERSION, expected $EXPECTED_VERSION"
fi

# Check status
STATUS=$(echo $HEALTH | jq -r '.status')
if [ "$STATUS" = "ok" ]; then
  echo "✅ Health status OK"
else
  echo "❌ Health status: $STATUS"
fi
```

## Troubleshooting

### Rollback Failed

```bash
# Check rollout history
kubectl rollout history deployment/<service-name> -n production

# If no history, manually set image
kubectl set image deployment/<service-name> \
  <container>=<previous-image-url> \
  -n production
```

### Previous Version Also Broken

1. Check rollout history for last known good version
2. Identify the last stable release from Git tags
3. Deploy that specific version manually

```bash
# Find last stable tag
git tag --list 'v*' --sort=-version:refname | head -5

# Deploy specific version
kubectl set image deployment/<service-name> \
  <container>=<aws-account>.dkr.ecr.us-east-1.amazonaws.com/skillancer/<service>:v<known-good> \
  -n production
```

### Pods Stuck Terminating

```bash
# Force delete stuck pods
kubectl delete pod <pod-name> -n production --force --grace-period=0

# If persistent, check finalizers
kubectl get pod <pod-name> -n production -o yaml | grep finalizers
```

## Post-Incident

After successful rollback:

1. **Do not re-deploy** until root cause is found
2. Document timeline in incident ticket
3. Schedule post-mortem
4. Update this runbook if gaps found

## Related Runbooks

- [Production Deployment](./production)
- [Database Migrations](./migrations)
- [High Error Rate](../incidents/high-error-rate)
