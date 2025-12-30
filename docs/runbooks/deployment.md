# Deployment Runbook

This runbook covers the standard deployment process for Skillancer services.

## Pre-Deployment Checklist

Before initiating any deployment:

- [ ] All tests passing in CI
- [ ] Database migrations tested on staging
- [ ] Feature flags configured correctly
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented
- [ ] Stakeholders notified
- [ ] Deployment window confirmed (low traffic)
- [ ] On-call engineer available

---

## Deployment Process

### 1. Create Release

```bash
# Create release branch
git checkout master
git pull origin master
git checkout -b release/v1.2.3

# Update version
npm version 1.2.3 --no-git-tag-version

# Commit version bump
git add .
git commit -m "chore(release): v1.2.3"

# Push for CI
git push origin release/v1.2.3
```

### 2. Run Database Migrations

**Before deploying application changes:**

```bash
# Check migration status
pnpm prisma migrate status

# Run migrations on staging first
pnpm prisma migrate deploy --preview-feature

# Verify migration success
pnpm prisma db pull --print
```

**Migration Safety Checklist:**

- [ ] Migration is backward compatible
- [ ] No destructive changes without data backup
- [ ] Indexes created concurrently where possible
- [ ] Large table migrations scheduled separately

### 3. Deploy Backend Services

**Rolling Update Strategy:**

```bash
# Deploy API Gateway
kubectl set image deployment/api-gateway \
  api-gateway=skillancer/api-gateway:v1.2.3 \
  -n production

# Watch rollout
kubectl rollout status deployment/api-gateway -n production

# Deploy other services
kubectl set image deployment/auth-svc \
  auth-svc=skillancer/auth-svc:v1.2.3 \
  -n production

kubectl set image deployment/market-svc \
  market-svc=skillancer/market-svc:v1.2.3 \
  -n production
```

**Deployment Order:**

1. Shared packages (if updated)
2. Database migrations
3. Backend services (parallel if independent)
4. API Gateway
5. Frontend applications

### 4. Deploy Frontend Applications

```bash
# Deploy web applications
vercel deploy --prod --token=$VERCEL_TOKEN

# Or via Kubernetes
kubectl set image deployment/web \
  web=skillancer/web:v1.2.3 \
  -n production
```

### 5. Verify Health Checks

```bash
# Check all endpoints
./scripts/health-check.sh production

# Expected output:
# ✅ API Gateway: healthy
# ✅ Auth Service: healthy
# ✅ Market Service: healthy
# ✅ SkillPod Service: healthy
# ✅ Web App: healthy
```

**Health Check Endpoints:**

| Service          | Endpoint      |
| ---------------- | ------------- |
| API Gateway      | `/health`     |
| Auth Service     | `/health`     |
| Market Service   | `/health`     |
| SkillPod Service | `/health`     |
| Web App          | `/api/health` |

### 6. Run Smoke Tests

```bash
# Run production smoke tests
pnpm test:smoke:production

# Manual verification checklist
# - [ ] Homepage loads
# - [ ] User can log in
# - [ ] Job listing works
# - [ ] Proposal submission works
# - [ ] Payment flow accessible
```

### 7. Monitor Error Rates

**Watch for 30 minutes post-deployment:**

```bash
# Monitor error rate
watch -n 5 'curl -s http://prometheus:9090/api/v1/query?query=rate(http_errors_total[1m])'

# Check Grafana dashboard
# https://grafana.skillancer.com/d/production-overview
```

**Alert Thresholds:**

- Error rate > 1%: Investigate
- Error rate > 5%: Consider rollback
- Error rate > 10%: Immediate rollback

---

## Rollback Procedure

### Immediate Rollback

If critical issues detected:

```bash
# Rollback deployment
kubectl rollout undo deployment/api-gateway -n production

# Verify rollback
kubectl rollout status deployment/api-gateway -n production

# Check previous version is running
kubectl describe deployment/api-gateway -n production | grep Image
```

### Database Rollback

**Only if migration caused issues:**

```bash
# Check migration history
pnpm prisma migrate status

# Rollback last migration (if rollback script exists)
pnpm prisma migrate resolve --rolled-back "migration_name"

# Manual rollback
psql $DATABASE_URL < ./migrations/rollback/migration_name.sql
```

### CDN Cache Clear

```bash
# Clear CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/*"

# Or specific paths
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/static/*" "/assets/*"
```

### Rollback Communication

```
🔄 **Deployment Rollback**

**Service**: [service name]
**From Version**: v1.2.3
**To Version**: v1.2.2
**Reason**: [brief reason]
**Time**: [timestamp]

Investigating root cause. Updates to follow.
```

---

## Environment-Specific Procedures

### Staging Deployment

```bash
# Deploy to staging
./scripts/deploy.sh staging v1.2.3

# Run full test suite
pnpm test:e2e --env=staging

# Staging URL: https://staging.skillancer.com
```

### Production Deployment

```bash
# Requires approval from engineering lead
./scripts/deploy.sh production v1.2.3 --require-approval

# Production URL: https://skillancer.com
```

### Canary Deployment

For high-risk changes:

```bash
# Deploy to 5% of traffic
kubectl apply -f k8s/canary/api-gateway-v1.2.3.yaml

# Monitor for 1 hour
# If successful, gradually increase
kubectl patch virtualservice api-gateway \
  --type merge \
  --patch '{"spec":{"http":[{"match":[{"headers":{"canary":{"exact":"true"}}}],"route":[{"destination":{"host":"api-gateway","subset":"v123"}}],"weight":10}]}}'

# Full rollout
kubectl delete -f k8s/canary/api-gateway-v1.2.3.yaml
kubectl set image deployment/api-gateway api-gateway=v1.2.3
```

---

## Feature Flags

### Enabling Features

```bash
# Enable feature for all users
curl -X POST https://api.skillancer.com/internal/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"flag": "new_dashboard", "enabled": true}'

# Enable for percentage of users
curl -X POST https://api.skillancer.com/internal/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"flag": "new_dashboard", "rollout_percentage": 25}'
```

### Disabling Features (Emergency)

```bash
# Kill switch for problematic feature
curl -X POST https://api.skillancer.com/internal/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"flag": "problematic_feature", "enabled": false}'
```

---

## Post-Deployment Tasks

### Documentation

- [ ] Update CHANGELOG.md
- [ ] Update API documentation if endpoints changed
- [ ] Notify customer success of user-facing changes

### Monitoring

- [ ] Verify all dashboards show normal metrics
- [ ] Check error tracking for new issues
- [ ] Review performance metrics

### Communication

```
✅ **Deployment Complete**

**Version**: v1.2.3
**Time**: [timestamp]
**Services**: All services updated
**Status**: All health checks passing

Key changes:
- Feature A implemented
- Bug B fixed
- Performance improvement C

No user action required.
```

---

## Deployment Schedule

### Recommended Windows

| Day       | Time (UTC)  | Notes                       |
| --------- | ----------- | --------------------------- |
| Tuesday   | 14:00-18:00 | Best for standard deploys   |
| Wednesday | 14:00-18:00 | Good alternative            |
| Thursday  | 14:00-16:00 | Early enough for Friday fix |

### Avoid

- Fridays (no weekend support)
- Mondays (high traffic start of week)
- Holidays
- During marketing campaigns

### Emergency Deployments

For critical fixes only:

1. Notify on-call and engineering lead
2. Minimal change scope
3. Extra monitoring period
4. Post-mortem if incident-related
