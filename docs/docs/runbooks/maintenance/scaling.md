# Scaling Services

Guide for scaling Skillancer services up or down based on demand.

**Last Verified**: 2024-01-25  
**Owner**: DevOps Team

## Overview

This runbook covers manual and automatic scaling procedures for Skillancer services. Use this when auto-scaling isn't sufficient or when preparing for known traffic events.

## Current Configuration

### Service Baseline (Normal Traffic)

| Service              | Min Replicas | Max Replicas | CPU Request | Memory Request |
| -------------------- | ------------ | ------------ | ----------- | -------------- |
| user-service         | 2            | 10           | 100m        | 256Mi          |
| project-service      | 2            | 10           | 100m        | 256Mi          |
| booking-service      | 2            | 8            | 100m        | 256Mi          |
| payment-service      | 2            | 6            | 100m        | 256Mi          |
| notification-service | 1            | 5            | 50m         | 128Mi          |
| search-service       | 2            | 8            | 200m        | 512Mi          |

### HPA Thresholds

| Metric       | Target | Scale Up | Scale Down |
| ------------ | ------ | -------- | ---------- |
| CPU          | 70%    | +2 pods  | -1 pod     |
| Memory       | 80%    | +2 pods  | -1 pod     |
| Requests/sec | 1000   | +1 pod   | -1 pod     |

## Monitoring Current Scale

```bash
# Current pod counts
kubectl get deployments -n production

# HPA status
kubectl get hpa -n production

# Pod resource usage
kubectl top pods -n production

# Node capacity
kubectl top nodes
kubectl describe nodes | grep -A 10 "Allocated resources"
```

## Manual Scaling

### Scale Up

```bash
# Scale specific service
kubectl scale deployment/<service-name> -n production --replicas=<N>

# Example: Scale user-service to 6 replicas
kubectl scale deployment/user-service -n production --replicas=6

# Verify scaling
kubectl get deployment <service-name> -n production
kubectl get pods -n production -l app=<service-name>
```

### Scale Down

```bash
# Scale down gradually (recommended)
CURRENT=$(kubectl get deployment <service-name> -n production -o jsonpath='{.spec.replicas}')
kubectl scale deployment/<service-name> -n production --replicas=$((CURRENT - 1))

# Verify pods are draining gracefully
kubectl get pods -n production -l app=<service-name> -w
```

### Scale All Services

```bash
# Scale all services proportionally (example: 2x)
for deploy in $(kubectl get deployments -n production -o jsonpath='{.items[*].metadata.name}'); do
  current=$(kubectl get deployment $deploy -n production -o jsonpath='{.spec.replicas}')
  new=$((current * 2))
  max=20  # Safety limit
  if [ $new -gt $max ]; then new=$max; fi
  echo "Scaling $deploy from $current to $new"
  kubectl scale deployment/$deploy -n production --replicas=$new
done
```

## Adjust HPA (Horizontal Pod Autoscaler)

### View Current HPA

```bash
kubectl get hpa -n production
kubectl describe hpa <service-name> -n production
```

### Update HPA Limits

```bash
# Update min/max replicas
kubectl patch hpa <service-name> -n production \
  --type='json' \
  -p='[
    {"op": "replace", "path": "/spec/minReplicas", "value": 4},
    {"op": "replace", "path": "/spec/maxReplicas", "value": 20}
  ]'

# Update target utilization
kubectl patch hpa <service-name> -n production \
  --type='json' \
  -p='[
    {"op": "replace", "path": "/spec/metrics/0/resource/target/averageUtilization", "value": 60}
  ]'
```

### Create HPA (if doesn't exist)

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 2
  maxReplicas: 10
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
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

```bash
kubectl apply -f hpa.yaml
```

## Vertical Scaling (Resources)

### Increase Pod Resources

```bash
# Update resource requests/limits
kubectl set resources deployment/<service-name> -n production \
  --requests=cpu=200m,memory=512Mi \
  --limits=cpu=500m,memory=1Gi

# This triggers a rolling update
kubectl rollout status deployment/<service-name> -n production
```

### Resource Recommendations

```bash
# If using Vertical Pod Autoscaler, check recommendations
kubectl get vpa -n production
kubectl describe vpa <service-name> -n production
```

## Node Scaling (EKS)

### Scale Node Group

```bash
# Check current node groups
aws eks describe-nodegroup \
  --cluster-name skillancer-production \
  --nodegroup-name main

# Scale node group
aws eks update-nodegroup-config \
  --cluster-name skillancer-production \
  --nodegroup-name main \
  --scaling-config minSize=3,maxSize=20,desiredSize=5
```

### Add Node Group for Specific Workloads

For high-memory or high-CPU services:

```bash
# Create specialized node group (via Terraform preferred)
aws eks create-nodegroup \
  --cluster-name skillancer-production \
  --nodegroup-name high-memory \
  --instance-types r5.xlarge \
  --scaling-config minSize=1,maxSize=5,desiredSize=2 \
  --labels workload=high-memory
```

## Database Scaling

### RDS Vertical Scaling

```bash
# Check current instance class
aws rds describe-db-instances \
  --db-instance-identifier skillancer-production \
  --query 'DBInstances[0].DBInstanceClass'

# Scale up (causes brief downtime)
aws rds modify-db-instance \
  --db-instance-identifier skillancer-production \
  --db-instance-class db.r5.xlarge \
  --apply-immediately

# Or schedule during maintenance window
aws rds modify-db-instance \
  --db-instance-identifier skillancer-production \
  --db-instance-class db.r5.xlarge
```

### Add Read Replica

```bash
# Create read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier skillancer-production-replica \
  --source-db-instance-identifier skillancer-production \
  --db-instance-class db.r5.large

# Update application to use replica for reads
# (requires code/config change)
```

### ElastiCache Scaling

```bash
# Scale Redis cluster
aws elasticache modify-replication-group \
  --replication-group-id skillancer-redis \
  --node-group-id 0001 \
  --replica-count 2
```

## Preparing for High Traffic Events

### Pre-Event Checklist

1. **Scale up 2-4 hours before event**

   ```bash
   # Scale all services to event capacity
   kubectl scale deployment/user-service -n production --replicas=8
   kubectl scale deployment/project-service -n production --replicas=8
   kubectl scale deployment/booking-service -n production --replicas=6
   ```

2. **Warm up caches**

   ```bash
   # Pre-populate common queries
   curl https://api.skillancer.com/projects/popular
   curl https://api.skillancer.com/categories
   ```

3. **Verify HPA has room to scale**

   ```bash
   kubectl patch hpa user-service -n production \
     --type='json' -p='[{"op": "replace", "path": "/spec/maxReplicas", "value": 20}]'
   ```

4. **Alert thresholds (temporary adjustment)**
   - Increase error rate threshold
   - Increase latency threshold

### Post-Event

1. **Monitor for 1 hour** after traffic normalizes
2. **Scale down gradually** (not all at once)
   ```bash
   # Every 15 minutes, reduce by 20%
   ```
3. **Reset HPA limits** to normal
4. **Review metrics** for capacity planning

## Troubleshooting

### Pods Not Scaling Up

```bash
# Check HPA status
kubectl describe hpa <service-name> -n production

# Common issues:
# - "unable to fetch metrics": metrics-server issue
# - "waiting for conditions": CPU/memory not exceeding threshold
# - "max replicas reached": increase maxReplicas

# Check metrics-server
kubectl top pods -n production
```

### Pods Stuck Pending

```bash
# Check for resource constraints
kubectl describe pod <pending-pod> -n production

# Check node capacity
kubectl describe nodes | grep -A 5 "Allocated resources"

# If nodes full, scale node group
```

### Scale Down Not Happening

```bash
# Check stabilization window
kubectl describe hpa <service-name> -n production | grep -A 5 Behavior

# Check if pods are receiving traffic
kubectl top pods -n production -l app=<service-name>
```

## Related Runbooks

- [Service Down](../incidents/service-down)
- [High Error Rate](../incidents/high-error-rate)
- [Database Maintenance](./database)
