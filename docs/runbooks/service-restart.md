# Service Restart Runbook

This runbook covers procedures for restarting Skillancer services in Kubernetes, including rolling restarts, emergency restarts, and rollback procedures.

## Overview

Skillancer services run as Kubernetes Deployments with multiple replicas. Service restarts should be performed using rolling updates to maintain availability.

## Prerequisites

- `kubectl` configured with cluster access
- Appropriate RBAC permissions
- Access to monitoring dashboards

## Quick Reference

| Service | Namespace | Min Replicas | Restart Command |
|---------|-----------|--------------|-----------------|
| api-gateway | skillancer-production | 3 | `kubectl rollout restart deployment/api-gateway -n skillancer-production` |
| auth-svc | skillancer-production | 3 | `kubectl rollout restart deployment/auth-svc -n skillancer-production` |
| market-svc | skillancer-production | 3 | `kubectl rollout restart deployment/market-svc -n skillancer-production` |
| billing-svc | skillancer-production | 2 | `kubectl rollout restart deployment/billing-svc -n skillancer-production` |
| notification-svc | skillancer-production | 2 | `kubectl rollout restart deployment/notification-svc -n skillancer-production` |
| skillpod-svc | skillancer-production | 4 | `kubectl rollout restart deployment/skillpod-svc -n skillancer-production` |
| cockpit-svc | skillancer-production | 2 | `kubectl rollout restart deployment/cockpit-svc -n skillancer-production` |

---

## Rolling Restart Procedure

### When to Use

- Configuration changes via ConfigMap/Secret
- Memory leak resolution
- Certificate rotation
- Routine maintenance

### Step 1: Pre-Restart Checks

```bash
# Check current deployment status
kubectl get deployment <service-name> -n skillancer-production

# Verify all pods are running
kubectl get pods -l app=<service-name> -n skillancer-production

# Check current resource usage
kubectl top pods -l app=<service-name> -n skillancer-production

# Verify HPA status
kubectl get hpa <service-name>-hpa -n skillancer-production
```

### Step 2: Initiate Rolling Restart

```bash
# Trigger rolling restart
kubectl rollout restart deployment/<service-name> -n skillancer-production

# Monitor rollout progress
kubectl rollout status deployment/<service-name> -n skillancer-production --timeout=5m
```

### Step 3: Verify Restart Success

```bash
# Check all pods are running and ready
kubectl get pods -l app=<service-name> -n skillancer-production -o wide

# Verify pod ages (should be recent)
kubectl get pods -l app=<service-name> -n skillancer-production \
  -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,AGE:.metadata.creationTimestamp

# Check logs for startup errors
kubectl logs -l app=<service-name> -n skillancer-production --tail=100 | grep -i error

# Test health endpoint
kubectl exec -it deployment/<service-name> -n skillancer-production -- \
  curl -s http://localhost:8080/health/ready
```

### Step 4: Post-Restart Monitoring

Monitor for 10-15 minutes:

- Check error rates in Grafana
- Verify response times are normal
- Confirm no alerting triggers
- Review application logs for warnings

---

## Emergency Restart Procedure

### When to Use

- Service completely unresponsive
- Critical bug requiring immediate restart
- Security incident requiring isolation

### Step 1: Assess Impact

```bash
# Check pod status
kubectl get pods -l app=<service-name> -n skillancer-production

# Check for crash loops
kubectl describe pods -l app=<service-name> -n skillancer-production | grep -A5 "State:"

# Check events
kubectl get events -n skillancer-production --sort-by='.lastTimestamp' | grep <service-name>
```

### Step 2: Scale Down Immediately (if needed)

```bash
# Scale to zero for complete stop
kubectl scale deployment/<service-name> --replicas=0 -n skillancer-production

# Wait for pods to terminate
kubectl wait --for=delete pod -l app=<service-name> -n skillancer-production --timeout=60s
```

### Step 3: Scale Back Up

```bash
# Scale back to minimum replicas
kubectl scale deployment/<service-name> --replicas=3 -n skillancer-production

# Monitor startup
kubectl get pods -l app=<service-name> -n skillancer-production -w
```

### Step 4: Verify Recovery

```bash
# Check all pods are ready
kubectl wait --for=condition=ready pod -l app=<service-name> \
  -n skillancer-production --timeout=300s

# Test service endpoint
kubectl run test-curl --rm -it --restart=Never --image=curlimages/curl -- \
  curl -s http://<service-name>:8080/health/ready
```

---

## Rollback Procedure

### When to Use

- New deployment causing errors
- Performance degradation after update
- Functionality broken after release

### Step 1: Check Rollout History

```bash
# View deployment history
kubectl rollout history deployment/<service-name> -n skillancer-production

# See details of specific revision
kubectl rollout history deployment/<service-name> -n skillancer-production --revision=<N>
```

### Step 2: Rollback to Previous Version

```bash
# Rollback to immediately previous version
kubectl rollout undo deployment/<service-name> -n skillancer-production

# Or rollback to specific revision
kubectl rollout undo deployment/<service-name> -n skillancer-production --to-revision=<N>
```

### Step 3: Monitor Rollback

```bash
# Watch rollback progress
kubectl rollout status deployment/<service-name> -n skillancer-production

# Verify rolled back image
kubectl get deployment/<service-name> -n skillancer-production \
  -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### Step 4: Confirm Stability

```bash
# Verify all pods healthy
kubectl get pods -l app=<service-name> -n skillancer-production

# Check logs for errors
kubectl logs -l app=<service-name> -n skillancer-production --tail=50
```

---

## Batch Restart All Services

### When to Use

- Cluster-wide configuration change
- After Kubernetes upgrade
- Security patch requiring all services restart

### Script: restart-all-services.sh

```bash
#!/bin/bash

NAMESPACE="skillancer-production"
SERVICES=(
  "api-gateway"
  "auth-svc"
  "market-svc"
  "billing-svc"
  "notification-svc"
  "skillpod-svc"
  "cockpit-svc"
)

echo "Starting rolling restart of all services..."

for service in "${SERVICES[@]}"; do
  echo "Restarting $service..."
  kubectl rollout restart deployment/$service -n $NAMESPACE

  echo "Waiting for $service rollout to complete..."
  kubectl rollout status deployment/$service -n $NAMESPACE --timeout=5m

  if [ $? -ne 0 ]; then
    echo "ERROR: $service failed to restart properly"
    exit 1
  fi

  echo "$service restarted successfully"
  echo "Waiting 30 seconds before next service..."
  sleep 30
done

echo "All services restarted successfully"
```

---

## Restarting with ConfigMap/Secret Updates

### Step 1: Update ConfigMap or Secret

```bash
# Edit ConfigMap
kubectl edit configmap <configmap-name> -n skillancer-production

# Or apply updated file
kubectl apply -f configmaps/<configmap-name>.yaml
```

### Step 2: Trigger Restart to Pick Up Changes

```bash
# Pods don't automatically restart on ConfigMap changes
# Trigger rolling restart
kubectl rollout restart deployment/<service-name> -n skillancer-production
```

### Alternative: Use ConfigMap Hash Annotation

Add to deployment spec to auto-restart on ConfigMap changes:

```yaml
spec:
  template:
    metadata:
      annotations:
        checksum/config: {{ sha256sum "configmaps/config.yaml" }}
```

---

## Troubleshooting Restart Issues

### Pods Stuck in Terminating

```bash
# Check for finalizers
kubectl get pods -l app=<service-name> -n skillancer-production -o yaml | grep finalizers

# Force delete if necessary (use with caution)
kubectl delete pod <pod-name> -n skillancer-production --grace-period=0 --force
```

### Pods Stuck in Pending

```bash
# Check events for scheduling issues
kubectl describe pod <pod-name> -n skillancer-production | grep -A10 Events

# Check node capacity
kubectl describe nodes | grep -A10 "Allocated resources"

# Check PDB constraints
kubectl get pdb -n skillancer-production
```

### Pods in CrashLoopBackOff

```bash
# Check logs from crashed container
kubectl logs <pod-name> -n skillancer-production --previous

# Check container exit code
kubectl describe pod <pod-name> -n skillancer-production | grep -A5 "Last State"

# Check resource limits
kubectl describe pod <pod-name> -n skillancer-production | grep -A5 "Limits"
```

### Readiness Probe Failing

```bash
# Check readiness probe configuration
kubectl get deployment/<service-name> -n skillancer-production -o yaml | grep -A10 readinessProbe

# Test readiness endpoint manually
kubectl exec -it <pod-name> -n skillancer-production -- \
  curl -v http://localhost:8080/health/ready
```

---

## Service-Specific Notes

### API Gateway

- **Critical service** - affects all API traffic
- Ensure at least 2 pods running during restart
- Monitor ingress controller logs after restart
- Check rate limiting is functioning

### Auth Service

- **Sessions may be affected** - warn users if extended downtime
- Verify JWT validation working after restart
- Test OAuth flows after restart
- Check Redis session store connectivity

### Billing Service

- **Payment-critical** - coordinate with finance team
- Verify Stripe webhook endpoint after restart
- Check pending payment processing
- Monitor for failed payment alerts

### SkillPod Service

- **Long-running sessions** - avoid during peak hours
- Existing sessions may be interrupted
- Pre-notify active users if possible
- Scale up before restart to handle reconnections

---

## Contacts

| Role | Contact |
|------|---------|
| Platform Team | #platform-oncall (Slack) |
| SRE Lead | @sre-lead (Slack) |
| Emergency | PagerDuty escalation |

## Related Documentation

- [Scaling Runbook](./scaling.md)
- [Incident Response](./incident-response.md)
- [Database Operations](./database-operations.md)
- [Deployment Runbook](./deployment.md)
