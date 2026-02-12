# Skillancer Rollback Procedure

> Last Updated: February 5, 2026
> Version: 1.0.0

This document provides step-by-step procedures for rolling back the Skillancer platform in the event of critical issues during or after launch.

**Recovery Time Objective (RTO):** 15 minutes
**Recovery Point Objective (RPO):** 5 minutes

---

## Table of Contents

1. [When to Trigger a Rollback](#when-to-trigger-a-rollback)
2. [Pre-Rollback Checklist](#pre-rollback-checklist)
3. [Service Rollback Steps](#service-rollback-steps)
4. [Database Rollback Steps](#database-rollback-steps)
5. [DNS Rollback](#dns-rollback)
6. [Infrastructure Rollback](#infrastructure-rollback)
7. [Feature Flag Rollback](#feature-flag-rollback)
8. [Rollback Verification](#rollback-verification)
9. [Communication Plan During Rollback](#communication-plan-during-rollback)
10. [Post-Rollback Actions](#post-rollback-actions)

---

## When to Trigger a Rollback

### Automatic Rollback Triggers

The following conditions should trigger an immediate rollback without waiting for manual approval:

| Condition                             | Detection Method           | Auto-Rollback |
| ------------------------------------- | -------------------------- | ------------- |
| Health check failures on >50% of pods | Kubernetes liveness probes | Yes           |
| Error rate exceeds 5% for >5 minutes  | Prometheus/Grafana alert   | Yes           |
| All payment processing fails          | Stripe webhook monitoring  | Yes           |
| Database connection pool exhausted    | Connection pool metrics    | Yes           |

### Manual Rollback Decision Matrix

| Scenario                             | Severity | Action                | Authority Required         |
| ------------------------------------ | -------- | --------------------- | -------------------------- |
| Complete platform outage             | P0       | Immediate rollback    | On-call + Engineering Lead |
| Data corruption detected             | P0       | Immediate rollback    | CTO required               |
| Security breach confirmed            | P0       | Immediate rollback    | CTO + Security Lead        |
| Major feature broken (>50% users)    | P1       | Evaluate rollback     | On-call + Engineering Lead |
| Payment processing failed            | P1       | Evaluate rollback     | On-call + Billing Lead     |
| Performance degradation (>500ms p95) | P2       | Fix forward preferred | On-call                    |
| Minor feature broken (<10% users)    | P2/P3    | Fix forward           | On-call                    |

### Decision Flow

```
Issue Detected
     |
     v
Can it be fixed with a feature flag toggle? --Yes--> Toggle flag, monitor
     |
     No
     v
Can it be fixed with a hotfix in <10 minutes? --Yes--> Deploy hotfix, monitor
     |
     No
     v
Is the issue P0 or P1? --Yes--> Initiate rollback
     |
     No
     v
Monitor and schedule fix for next deployment
```

---

## Pre-Rollback Checklist

Before initiating any rollback, complete these steps:

- [ ] Confirm the issue cannot be resolved with a feature flag toggle
- [ ] Confirm the issue cannot be resolved with a quick hotfix (<10 minutes)
- [ ] Get approval from the required authority (see decision matrix above)
- [ ] Alert `#launch-war-room` channel: "ROLLBACK INITIATED"
- [ ] Update status page (status.skillancer.com): "Investigating issues, remediation in progress"
- [ ] Notify Support team to pause outgoing customer responses
- [ ] Designate an incident commander to coordinate the rollback
- [ ] Start a timeline log in the incident channel

---

## Service Rollback Steps

### Step 1: Kubernetes Application Rollback

**When to use:** Application bugs, broken features, code-level regressions
**Estimated time:** 5 minutes

```bash
# 1. Identify current deployment versions
kubectl get deployments -n production -o wide

# 2. Check rollout history for available versions
kubectl rollout history deployment/skillancer-api -n production
kubectl rollout history deployment/skillancer-web -n production

# 3. Rollback all application services
kubectl rollout undo deployment/skillancer-web -n production
kubectl rollout undo deployment/skillancer-api -n production
kubectl rollout undo deployment/skillancer-notification -n production
kubectl rollout undo deployment/skillancer-search -n production
kubectl rollout undo deployment/skillancer-skillpod -n production

# 4. Monitor rollback progress
kubectl rollout status deployment/skillancer-web -n production
kubectl rollout status deployment/skillancer-api -n production

# 5. Verify all pods are healthy
kubectl get pods -n production -l app=skillancer
```

### Step 2: Using the Rollback Script

For a coordinated rollback of all services:

```bash
# Rollback to the last known-good version
./scripts/rollback.sh \
  --environment=production \
  --version=v1.0.0-rc.5 \
  --confirm

# Rollback to a specific version
./scripts/rollback.sh \
  --environment=production \
  --version=<target-version> \
  --confirm
```

### Step 3: Verify Service Health

```bash
# Check all endpoints
curl -s https://api.skillancer.com/health | jq
curl -s https://api.skillancer.com/health/dashboard | jq
curl -s https://skillancer.com | grep -q "Skillancer" && echo "Web OK"

# Verify pod status
kubectl get pods -n production -l app=skillancer --field-selector=status.phase=Running
```

### Known-Good Versions

Keep this list updated before each deployment:

| Version     | Date       | Notes                         |
| ----------- | ---------- | ----------------------------- |
| v1.0.0-rc.5 | Pre-launch | Last stable release candidate |
| v1.0.0-rc.4 | Pre-launch | Two releases back             |
| v1.0.0-rc.3 | Pre-launch | Three releases back           |

---

## Database Rollback Steps

### Option A: Schema-Only Rollback (Prisma Migration Revert)

**When to use:** A migration introduced a schema change that is causing errors
**Estimated time:** 10 minutes

```bash
# 1. Check current migration status
npx prisma migrate status

# 2. Mark the problematic migration as rolled back
npx prisma migrate resolve --rolled-back <migration_name>

# 3. Apply the previous schema state
npx prisma db push --accept-data-loss

# 4. Restart application services to pick up schema changes
kubectl rollout restart deployment/skillancer-api -n production
```

**WARNING:** `--accept-data-loss` may drop columns or tables added by the rolled-back migration. Ensure you have a backup before proceeding.

### Option B: Point-in-Time Recovery (AWS RDS)

**When to use:** Data corruption, bad data migration, need to restore to a specific moment
**Estimated time:** 15-30 minutes

```bash
# 1. Identify the target restore time (before the issue occurred)
TARGET_TIME="2026-02-05T08:00:00Z"

# 2. Create a restored database instance
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier skillancer-prod \
  --target-db-instance-identifier skillancer-prod-restored \
  --restore-time $TARGET_TIME \
  --db-instance-class db.r6g.xlarge \
  --availability-zone us-east-1a

# 3. Wait for the restored instance to become available
aws rds wait db-instance-available \
  --db-instance-identifier skillancer-prod-restored

# 4. Get the new endpoint
aws rds describe-db-instances \
  --db-instance-identifier skillancer-prod-restored \
  --query 'DBInstances[0].Endpoint.Address'

# 5. Update DATABASE_URL in secrets manager / Doppler
doppler secrets set DATABASE_URL="postgresql://user:pass@<new-endpoint>:5432/skillancer"

# 6. Restart application services
kubectl rollout restart deployment/skillancer-api -n production

# 7. Verify data integrity
npm run db:verify
```

### Option C: Full Snapshot Restore

**When to use:** Complete database recovery from a daily snapshot
**Estimated time:** 30-60 minutes

```bash
# 1. List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier skillancer-prod \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]' \
  --output table

# 2. Restore from the most recent clean snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier skillancer-prod-restored \
  --db-snapshot-identifier <snapshot-id>

# 3. Wait for availability, then follow steps 3-7 from Option B above
```

### Database Rollback Considerations

- **Backup frequency:** Automated snapshots every hour, retained 7 days
- **Point-in-time recovery:** Available for the last 7 days with 5-minute granularity
- **Cross-region replication:** Enabled for disaster recovery
- **Data written after the restore point will be lost.** Communicate this to affected users.
- After any database rollback, verify Redis cache consistency and clear stale entries if needed.

---

## DNS Rollback

### When to Use

- DNS cutover caused connectivity issues
- Need to redirect traffic to a maintenance page
- Region-specific routing problems

### Step 1: Switch to Maintenance Page

```bash
# Route 53: Point production domain to maintenance page
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "skillancer.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2MAINTENANCE",
          "DNSName": "maintenance.skillancer.com",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

### Step 2: Revert DNS to Previous Configuration

```bash
# Restore the original DNS records from the backup configuration
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://dns-backup-config.json
```

### Step 3: CDN Rollback (CloudFront)

```bash
# Revert CloudFront distribution to previous configuration
aws cloudfront update-distribution \
  --id E1234567890ABC \
  --distribution-config file://cloudfront-backup-config.json

# Invalidate CDN cache to serve correct content
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### DNS Propagation Notes

- DNS changes can take 5-60 minutes to propagate globally
- TTLs should be lowered to 5 minutes 24 hours before launch
- Use multiple DNS checkers to verify propagation (dnschecker.org, whatsmydns.net)
- During propagation, some users will see old content and others new content

---

## Infrastructure Rollback

### Terraform State Rollback

**When to use:** Infrastructure configuration changes caused issues (networking, scaling, etc.)
**Estimated time:** 10-30 minutes

```bash
# 1. Navigate to terraform directory
cd infrastructure/terraform/production

# 2. Review what will change
terraform plan -target=module.ecs -var-file=previous-values.tfvars

# 3. Apply the previous configuration
terraform apply -target=module.ecs -var-file=previous-values.tfvars -auto-approve

# 4. Verify infrastructure state
terraform state list
kubectl get nodes
kubectl get pods -n production
```

---

## Feature Flag Rollback

**When to use:** A newly enabled feature is causing problems; fastest rollback option
**Estimated time:** 30 seconds

```bash
# Disable specific features via Doppler
doppler secrets set FEATURE_SKILLPOD_ENABLED=false
doppler secrets set FEATURE_NEW_MATCHING=false
doppler secrets set FEATURE_COPILOT_ENABLED=false

# Or disable via admin API
curl -X POST https://api.skillancer.com/admin/flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"flag": "skillpod_enabled", "enabled": false}'

# Emergency: disable ALL features
curl -X POST https://api.skillancer.com/admin/flags/disable-all \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Enable maintenance mode
curl -X POST https://api.skillancer.com/admin/maintenance/enable \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Feature flags are Redis-backed and take effect immediately without requiring a service restart.

---

## Rollback Verification

After completing any rollback, verify the following:

### Health Checks

```bash
# Run the smoke test suite
npm run test:smoke -- --env=production

# Verify individual endpoints
curl -sf https://api.skillancer.com/health | jq '.status'
curl -sf https://skillancer.com | grep -q "Skillancer" && echo "Web: OK" || echo "Web: FAILED"
curl -sf https://api.skillancer.com/health | grep -q "healthy" && echo "API: OK" || echo "API: FAILED"
```

### Metrics Verification

- [ ] Error rate returned to baseline (<0.1%)
- [ ] Response times normal (p95 <200ms)
- [ ] Database connections stable (no pool exhaustion)
- [ ] Memory/CPU within normal range
- [ ] No new error patterns in Sentry
- [ ] No new error patterns in logs

### Functional Verification

- [ ] User registration and login working
- [ ] Job posting and browsing working
- [ ] Proposal submission working
- [ ] Payment processing working (Stripe + PayPal)
- [ ] Email notifications delivering
- [ ] Search functionality returning results
- [ ] Mobile API endpoints responding

---

## Communication Plan During Rollback

### Internal Communication

#### Immediate (T+0 minutes)

Post to `#launch-war-room` and `#engineering`:

```
ROLLBACK INITIATED

Severity: [P0/P1]
Issue: [Brief description of the problem]
Impact: [Who/what is affected]
Rollback Lead: @[engineer-name]
ETA: [Estimated time to restore service]

Updates will follow every 10 minutes in this channel.
```

#### During Rollback (Every 10 minutes)

```
ROLLBACK UPDATE - [HH:MM UTC]

Status: [In Progress / Completing / Verifying]
Progress: [What has been done so far]
Next Step: [What is happening next]
ETA: [Updated estimate]
```

#### Rollback Complete

```
ROLLBACK COMPLETE - [HH:MM UTC]

Duration: [Total time]
Services Restored: [List of services]
Version: [Rolled back to version X]
Verification: [Health checks passing / Smoke tests passing]

Next Steps:
- Monitor for 1 hour
- Begin root cause analysis
- Schedule post-mortem within 48 hours
```

### External Communication

#### Status Page Updates

**Investigating (immediate):**

```
We are currently investigating reports of service disruption on the Skillancer platform.
Some users may experience errors or degraded performance.
Our engineering team is actively working on resolving this issue.
We will provide updates as we have more information.
```

**Identified (once rollback is decided):**

```
We have identified the cause of the current service disruption.
Our team is implementing a fix and we expect to restore full service within [time estimate].
We apologize for any inconvenience.
```

**Resolved (after verification):**

```
The service disruption affecting the Skillancer platform has been resolved.
All services are now operating normally.
We apologize for any inconvenience this may have caused.
A detailed review will be conducted to prevent future occurrences.
```

#### Customer Email (for extended outages >30 minutes)

```
Subject: Skillancer Service Update - [Date]

Dear [Customer Name],

We want to inform you about a service disruption that occurred on [date]
between [start time] and [end time] UTC.

What happened:
[Brief, non-technical explanation of the issue]

What we did:
[Actions taken to resolve the issue]

Impact to you:
[Specific impact - e.g., "Any work saved during this window was preserved"
or "Transactions during this window may need to be re-submitted"]

What we are doing to prevent this:
[Preventive measures being taken]

If you experienced any issues during this time or have questions, please
contact our support team at support@skillancer.com.

We sincerely apologize for any inconvenience.

The Skillancer Team
```

### Notification Responsibilities

| Audience                | Channel                    | Responsible         | Timing            |
| ----------------------- | -------------------------- | ------------------- | ----------------- |
| Engineering team        | Team Chat #launch-war-room | Incident Commander  | Immediate         |
| Support team            | Team Chat #support         | Incident Commander  | Within 5 minutes  |
| Executive team          | Direct Message / Phone     | Engineering Lead    | Within 10 minutes |
| Customers (status page) | status.skillancer.com      | Support Lead        | Within 10 minutes |
| Customers (email)       | Email                      | Marketing + Support | After resolution  |
| Public (social media)   | Twitter/LinkedIn           | Marketing Lead      | After resolution  |

---

## Post-Rollback Actions

### Immediate (Within 1 Hour)

1. Update status page with resolution details
2. Notify all stakeholders that service is restored
3. Preserve all logs, metrics, and traces for investigation
4. Document a complete timeline of events in the incident channel
5. Begin root cause analysis
6. Ensure on-call continues monitoring for 4 hours minimum

### Same Day

1. Complete the initial incident report (see [Incident Response Plan](./incident-response.md))
2. Identify whether the issue was in code, configuration, infrastructure, or data
3. Draft a fix and test it in staging
4. Plan the re-deployment strategy (with additional safeguards)

### Within 48 Hours

1. Hold post-mortem meeting (blameless, action-oriented)
2. Assign and track prevention action items
3. Update runbooks and documentation based on learnings
4. Communicate learnings to the broader team

---

## Emergency Contacts

| Role              | Name | Phone | Availability               |
| ----------------- | ---- | ----- | -------------------------- |
| On-call Primary   |      |       | 24/7 (PagerDuty)           |
| On-call Secondary |      |       | 24/7 (PagerDuty)           |
| Engineering Lead  |      |       | Escalation                 |
| Database Admin    |      |       | Escalation                 |
| CTO               |      |       | P0 Escalation              |
| AWS TAM           |      |       | Business hours + emergency |

---

## Related Documents

- [Launch Checklist](./launch-checklist.md)
- [Incident Response Plan](./incident-response.md)
- [Rollback Plan (Detailed Technical)](./rollback-plan.md)
- [Database Operations Runbook](../runbooks/database-operations.md)
- [Deployment Runbook](../deployment-runbook.md)
- [Security Incident Runbook](../runbooks/security-incident.md)
