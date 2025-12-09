# Production Deployment

Step-by-step guide for deploying services to production.

**Last Verified**: 2024-01-25  
**Owner**: DevOps Team

## Overview

This runbook covers the standard deployment process for Skillancer services to production. All deployments go through CI/CD, but this guide helps when manual intervention is needed.

## Prerequisites

- [ ] Access to AWS Console (production account)
- [ ] kubectl configured for production cluster
- [ ] GitHub access with merge permissions
- [ ] Access to #deployments Slack channel
- [ ] PagerDuty account for on-call status

## Pre-Deployment Checklist

```bash
# 1. Verify CI/CD status - all checks should be green
gh pr checks <PR_NUMBER>

# 2. Check current production status
kubectl get pods -n production

# 3. Verify no active incidents
# Check PagerDuty and #incidents channel

# 4. Announce deployment
# Post in #deployments: "Starting deployment of <service> v<version>"
```

## Deployment Procedure

### Standard Deployment (via CI/CD)

1. **Merge to main branch**

   ```bash
   gh pr merge <PR_NUMBER> --merge
   ```

2. **Monitor GitHub Actions**
   - Navigate to Actions tab
   - Watch the deployment workflow
   - Expected duration: ~10-15 minutes

3. **Verify deployment**

   ```bash
   # Check pod status
   kubectl get pods -n production -l app=<service-name>

   # Check rollout status
   kubectl rollout status deployment/<service-name> -n production

   # Verify new version
   kubectl describe deployment/<service-name> -n production | grep Image
   ```

### Manual Deployment (Emergency Only)

:::warning
Manual deployments should only be used when CI/CD is unavailable. Always prefer automated deployments.
:::

1. **Build and push image**

   ```bash
   # Build image
   docker build -t skillancer/<service>:v<version> .

   # Tag for ECR
   docker tag skillancer/<service>:v<version> \
     <aws-account>.dkr.ecr.us-east-1.amazonaws.com/skillancer/<service>:v<version>

   # Login to ECR
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin \
     <aws-account>.dkr.ecr.us-east-1.amazonaws.com

   # Push image
   docker push <aws-account>.dkr.ecr.us-east-1.amazonaws.com/skillancer/<service>:v<version>
   ```

2. **Update deployment**

   ```bash
   # Update image
   kubectl set image deployment/<service-name> \
     <service-name>=<aws-account>.dkr.ecr.us-east-1.amazonaws.com/skillancer/<service>:v<version> \
     -n production

   # Watch rollout
   kubectl rollout status deployment/<service-name> -n production
   ```

## Verification Steps

### 1. Health Checks

```bash
# Check health endpoint
curl -s https://api.skillancer.com/<service>/health | jq .

# Expected output:
# {
#   "status": "ok",
#   "version": "v1.2.3",
#   "uptime": 123
# }
```

### 2. Smoke Tests

```bash
# Run smoke test suite
pnpm test:smoke --env=production

# Or manual verification
curl -s https://api.skillancer.com/<service>/api/v1/ping
```

### 3. Monitor Metrics

Check Grafana dashboards for:

- Request rate (should be normal)
- Error rate (should be < 0.1%)
- Latency P99 (should be < 500ms)
- Pod CPU/Memory (should be stable)

### 4. Check Logs

```bash
# Stream logs from new pods
kubectl logs -f deployment/<service-name> -n production --since=5m

# Look for:
# - No error messages
# - Successful startup
# - Normal request patterns
```

## Post-Deployment

1. **Update deployment channel**

   ```
   ✅ Deployment complete: <service> v<version>
   - All health checks passing
   - Metrics stable
   - No errors in logs
   ```

2. **Monitor for 15 minutes**
   - Watch error rates
   - Check for customer reports
   - Be ready to rollback

3. **Update changelog** (if applicable)
   - Document notable changes
   - Update status page if needed

## Rollback Trigger Conditions

Initiate rollback if:

- Error rate > 1% for 5 minutes
- P99 latency > 2s for 5 minutes
- Health checks failing
- Critical functionality broken

See [Rollback Procedures](./rollback) for rollback steps.

## Troubleshooting

### Deployment Stuck

```bash
# Check pod events
kubectl describe pod -l app=<service-name> -n production

# Common issues:
# - Image pull errors: Check ECR permissions
# - CrashLoopBackOff: Check application logs
# - Pending: Check resource limits
```

### Pods Not Starting

```bash
# Get detailed pod info
kubectl get pods -n production -o wide

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'

# Check resource availability
kubectl describe nodes
```

### Connection Issues

```bash
# Check service endpoints
kubectl get endpoints <service-name> -n production

# Verify service configuration
kubectl describe service <service-name> -n production
```

## Related Runbooks

- [Rollback Procedures](./rollback)
- [Database Migrations](./migrations)
- [Service Down](../incidents/service-down)
