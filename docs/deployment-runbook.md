# Deployment Runbook

This runbook provides step-by-step procedures for handling deployment scenarios and incidents.

## Table of Contents

1. [Standard Deployment](#standard-deployment)
2. [Hotfix Deployment](#hotfix-deployment)
3. [Rollback Procedures](#rollback-procedures)
4. [Incident Response](#incident-response)
5. [Post-Deployment Verification](#post-deployment-verification)

---

## Standard Deployment

### Prerequisites

- [ ] All CI checks passing on `main`
- [ ] Code reviewed and approved
- [ ] Release notes prepared
- [ ] Team notified in #deployments channel

### Procedure

1. **Verify Staging**

   ```bash
   # Check staging health
   ./scripts/health-check.sh staging --full
   ```

2. **Trigger Production Deployment**
   - Go to GitHub Actions → Deploy workflow
   - Click "Run workflow"
   - Select `production`
   - Select services or `all`
   - Click "Run workflow"

3. **Approve Deployment**
   - Wait for staging deployment to complete
   - Review staging in browser
   - Click "Approve" in GitHub Actions

4. **Monitor Deployment**
   - Watch workflow progress
   - Monitor Slack for notifications
   - Check AWS ECS console

5. **Verify Production**

   ```bash
   ./scripts/health-check.sh production --full
   ```

6. **Post-Deployment**
   - [ ] Verify key user flows
   - [ ] Check error rates in monitoring
   - [ ] Update deployment log
   - [ ] Notify team of completion

---

## Hotfix Deployment

For critical bug fixes that need immediate deployment.

### Procedure

1. **Create Hotfix Branch**

   ```bash
   git checkout main
   git pull
   git checkout -b hotfix/critical-bug-fix
   ```

2. **Apply Fix**
   - Make minimal, targeted changes
   - Add tests for the fix
   - Get expedited review

3. **Merge to Main**

   ```bash
   git checkout main
   git merge hotfix/critical-bug-fix
   git push
   ```

4. **Deploy to Production**
   - Go to GitHub Actions → Deploy workflow
   - Select `production`
   - Check "Skip staging" if staging already verified
   - Run workflow and approve immediately

5. **Verify Fix**
   - Confirm bug is resolved
   - Monitor for any side effects
   - Document the incident

---

## Rollback Procedures

### Automatic Rollback (Failed Deployment)

When a production deployment fails:

1. **Automatic rollback is triggered**
   - Services revert to previous version
   - Slack notification sent

2. **Verify Rollback**

   ```bash
   ./scripts/health-check.sh production
   ```

3. **Investigate Failure**
   - Review workflow logs
   - Check application logs
   - Identify root cause

4. **Fix and Retry**
   - Fix the issue in a new PR
   - Merge and redeploy

### Manual Rollback

When you need to manually rollback:

#### Via GitHub Actions

1. Go to Actions → **Manual Rollback**
2. Select environment (`staging` or `production`)
3. Select service (or `all`)
4. Optionally specify version
5. Enter reason for rollback
6. Click "Run workflow"

#### Via CLI

```bash
# Rollback single service to previous
./scripts/rollback.sh production api-gateway

# Rollback to specific version
./scripts/rollback.sh production api-gateway v1.2.3

# Rollback all services
./scripts/rollback.sh production all
```

#### Via AWS Console

1. Go to ECS → Clusters → skillancer-prod
2. Select the service
3. Click "Update"
4. Under Task Definition, select previous revision
5. Check "Force new deployment"
6. Click "Update"

### Rollback Decision Matrix

| Symptom                | Action                           |
| ---------------------- | -------------------------------- |
| 5xx errors > 1%        | Immediate rollback               |
| Response time > 5s     | Investigate, consider rollback   |
| Single service failing | Rollback that service            |
| Database errors        | DO NOT rollback, investigate     |
| Memory/CPU spike       | Scale up first, then investigate |

---

## Incident Response

### Severity Levels

| Level | Description                      | Response Time     |
| ----- | -------------------------------- | ----------------- |
| P1    | Service down, all users affected | Immediate         |
| P2    | Major feature broken             | 15 minutes        |
| P3    | Minor feature broken             | 1 hour            |
| P4    | Cosmetic issue                   | Next business day |

### P1 Incident Procedure

1. **Alert (0-5 minutes)**
   - Slack alert received
   - On-call engineer acknowledged
   - War room created in Slack

2. **Assess (5-10 minutes)**

   ```bash
   # Check service health
   ./scripts/health-check.sh production

   # Check ECS status
   aws ecs describe-services \
     --cluster skillancer-prod \
     --services api-gateway auth-svc market-svc
   ```

3. **Mitigate (10-30 minutes)**

   If deployment-related:

   ```bash
   ./scripts/rollback.sh -y production all
   ```

   If not deployment-related:
   - Scale up resources
   - Enable rate limiting
   - Redirect to maintenance page

4. **Communicate**
   - Update status page
   - Notify affected customers
   - Post updates every 15 minutes

5. **Resolve**
   - Identify root cause
   - Apply fix
   - Verify resolution

6. **Post-Mortem**
   - Document timeline
   - Identify improvements
   - Create action items

### Communication Templates

**Initial Alert:**

```
🚨 INCIDENT: [Service] experiencing issues
- Impact: [Description of user impact]
- Status: Investigating
- ETA: Unknown
```

**Update:**

```
📍 UPDATE: [Service] incident
- Status: [Mitigating/Identified/Monitoring]
- Action: [What we're doing]
- ETA: [Estimated time to resolution]
```

**Resolved:**

```
✅ RESOLVED: [Service] incident
- Duration: [X minutes]
- Impact: [Summary of impact]
- Resolution: [What fixed it]
- Follow-up: [Action items]
```

---

## Post-Deployment Verification

### Automated Checks

These run automatically after deployment:

- [ ] Health endpoint returns 200
- [ ] Readiness endpoint returns 200
- [ ] API status endpoint returns 200

### Manual Verification Checklist

After each production deployment:

#### Critical Paths

- [ ] User can log in
- [ ] User can view marketplace
- [ ] User can create/view projects
- [ ] Payments process correctly
- [ ] Notifications are delivered

#### Performance

- [ ] Homepage loads < 3s
- [ ] API responses < 500ms
- [ ] No timeout errors in logs

#### Integrations

- [ ] Database connections healthy
- [ ] Redis connections healthy
- [ ] External APIs responding

### Verification Script

```bash
#!/bin/bash
# Quick verification script

BASE_URL="https://api.skillancer.com"

echo "Testing critical endpoints..."

# Health Dashboard (aggregated status)
echo "=== Health Dashboard ==="
curl -s "$BASE_URL/health/dashboard" | jq '{overall, summary, coreServices: (.coreServices | keys), moatServices: (.moatServices | keys)}'

# Liveness & Readiness
echo "=== Liveness ==="
curl -s "$BASE_URL/health/live" | jq .

echo "=== Readiness ==="
curl -s "$BASE_URL/health/ready" | jq .

# Circuit Breakers
echo "=== Circuit Breakers ==="
curl -s "$BASE_URL/health/circuits" | jq .

# Auth
echo "=== Auth Status ==="
curl -s "$BASE_URL/api/v1/auth/status" | jq .

echo "All checks complete!"
```

---

## Appendix

### Useful Commands

```bash
# View ECS service status
aws ecs describe-services \
  --cluster skillancer-prod \
  --services api-gateway

# View recent deployments
aws ecs describe-services \
  --cluster skillancer-prod \
  --services api-gateway \
  --query 'services[0].deployments'

# View task logs
aws logs tail /ecs/skillancer-prod-api-gateway --follow

# List task definitions
aws ecs list-task-definitions \
  --family-prefix skillancer-prod-api-gateway \
  --sort DESC

# Force new deployment without changes
aws ecs update-service \
  --cluster skillancer-prod \
  --service api-gateway \
  --force-new-deployment
```

### Contacts

| Role             | Contact          |
| ---------------- | ---------------- |
| On-Call Engineer | PagerDuty        |
| DevOps Lead      | @devops-lead     |
| Backend Lead     | @backend-lead    |
| AWS Support      | Case via Console |

### Related Documentation

- [Deployment Documentation](./deployment.md)
- [Preview Deployments](./preview-deployments.md)
- [Monitoring & Alerting](./monitoring.md)
- [Infrastructure](./infrastructure.md)
