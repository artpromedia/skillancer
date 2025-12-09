# Deployment Runbooks

Procedures for deploying and releasing Skillancer services.

## Available Runbooks

| Runbook                               | Description                    | When to Use       |
| ------------------------------------- | ------------------------------ | ----------------- |
| [Production Deployment](./production) | Deploy services to production  | Standard releases |
| [Rollback Procedures](./rollback)     | Revert problematic deployments | Deployment issues |
| [Database Migrations](./migrations)   | Run and manage migrations      | Schema changes    |

## Deployment Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Deployment Pipeline                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────────┐  │
│  │  Code   │───▶│   CI    │───▶│ Staging │───▶│   Production    │  │
│  │  Push   │    │  Tests  │    │ Deploy  │    │     Deploy      │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────────────┘  │
│       │              │              │                   │           │
│       │              │              │                   │           │
│       ▼              ▼              ▼                   ▼           │
│   PR Created    All Tests      Smoke Tests        Health Checks    │
│                  Pass          Pass                 Pass            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Commands

### Check Deployment Status

```bash
# Kubernetes deployment status
kubectl get deployments -n production

# Recent deployments
kubectl rollout history deployment/<service> -n production

# Current pod status
kubectl get pods -n production -l app=<service>
```

### Health Checks

```bash
# All services
for svc in user project booking payment; do
  echo "Checking $svc..."
  curl -s https://api.skillancer.com/$svc/health | jq '.status'
done
```

### Emergency Rollback

```bash
# Immediate rollback
kubectl rollout undo deployment/<service> -n production

# Verify
kubectl rollout status deployment/<service> -n production
```

## Deployment Schedule

| Day      | Time (UTC)     | Type                  |
| -------- | -------------- | --------------------- |
| Mon-Thu  | 14:00-18:00    | Standard deployments  |
| Friday   | 14:00-16:00    | Only critical fixes   |
| Weekends | Emergency only | With on-call approval |

## Related Documentation

- [CI/CD Workflow](/architecture/tech-stack#cicd)
- [Service Architecture](/architecture/)
- [Incident Response](../incidents/)
