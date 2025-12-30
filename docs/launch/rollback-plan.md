# Rollback Plan

## Overview

This document provides detailed procedures for rolling back Skillancer in case of critical issues during or after launch. The goal is to restore service within the defined Recovery Time Objective (RTO) while minimizing data loss within the Recovery Point Objective (RPO).

**RTO Target:** 15 minutes  
**RPO Target:** 5 minutes

---

## Rollback Decision Matrix

| Scenario                             | Severity | Rollback?        | Authority               |
| ------------------------------------ | -------- | ---------------- | ----------------------- |
| Complete platform outage             | P0       | Yes              | On-call + Lead          |
| Data corruption detected             | P0       | Yes              | CTO required            |
| Security breach confirmed            | P0       | Yes              | CTO + Security required |
| Major feature broken (>50% users)    | P1       | Consider         | On-call + Lead          |
| Payment processing failed            | P1       | Consider         | On-call + Billing Lead  |
| Performance degradation (>500ms p95) | P2       | No - fix forward | On-call                 |
| Minor feature broken                 | P2/P3    | No - fix forward | On-call                 |

---

## Pre-Rollback Checklist

Before initiating any rollback:

- [ ] Confirm the issue cannot be resolved with a feature flag
- [ ] Confirm the issue cannot be resolved with a quick fix (<10 min)
- [ ] Get approval from required authority (see matrix above)
- [ ] Alert #launch-war-room: "ROLLBACK INITIATED"
- [ ] Update status page: "Investigating issues, remediation in progress"
- [ ] Notify Support team to pause customer responses

---

## Rollback Procedures

### 1. Application Rollback (Kubernetes)

**When to use:** Application bugs, broken features, code-level issues

**Time to complete:** ~5 minutes

```bash
# 1. Identify current and target versions
kubectl get deployments -n production -o wide

# 2. Check available versions
kubectl rollout history deployment/skillancer-web -n production

# 3. Rollback to previous version
kubectl rollout undo deployment/skillancer-web -n production
kubectl rollout undo deployment/skillancer-api -n production

# 4. Verify rollback
kubectl rollout status deployment/skillancer-web -n production
kubectl rollout status deployment/skillancer-api -n production

# 5. Verify pods are healthy
kubectl get pods -n production -l app=skillancer
```

**Or use the rollback script:**

```bash
cd /path/to/skillancer
./scripts/rollback.sh \
  --environment=production \
  --version=v1.0.0-rc.5 \
  --confirm
```

### 2. Database Rollback

**When to use:** Schema migration failures, data corruption

**Time to complete:** ~10-30 minutes (depending on data size)

#### 2a. Schema-Only Rollback

```bash
# 1. List migration history
npx prisma migrate status

# 2. Revert to specific migration
npx prisma migrate resolve --rolled-back <migration_name>

# 3. Apply previous schema
npx prisma db push --accept-data-loss
```

#### 2b. Point-in-Time Recovery (AWS RDS)

```bash
# 1. Identify target restore time (before issue occurred)
TARGET_TIME="2024-01-15T10:30:00Z"

# 2. Create restore instance
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier skillancer-prod \
  --target-db-instance-identifier skillancer-prod-restored \
  --restore-time $TARGET_TIME \
  --db-instance-class db.r6g.xlarge \
  --availability-zone us-east-1a

# 3. Wait for instance to be available
aws rds wait db-instance-available \
  --db-instance-identifier skillancer-prod-restored

# 4. Update application to use restored DB
# (Update DATABASE_URL in environment/secrets)

# 5. Verify data integrity
npm run db:verify
```

#### 2c. Full Database Restore from Backup

```bash
# 1. List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier skillancer-prod \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]'

# 2. Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier skillancer-prod-restored \
  --db-snapshot-identifier skillancer-prod-snapshot-20240115

# 3. Follow steps 3-5 from Point-in-Time Recovery above
```

### 3. Feature Flag Rollback

**When to use:** New feature causing issues, quick disable needed

**Time to complete:** ~30 seconds

```bash
# Using Doppler/feature flag service
doppler secrets set FEATURE_SKILLPOD_ENABLED=false
doppler secrets set FEATURE_NEW_MATCHING=false
doppler secrets set MAINTENANCE_MODE=true

# Or via admin API
curl -X POST https://api.skillancer.com/admin/flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"flag": "skillpod_enabled", "enabled": false}'
```

### 4. CDN/DNS Rollback

**When to use:** DNS or CDN configuration issues, region-specific problems

**Time to complete:** ~5-15 minutes (DNS propagation dependent)

```bash
# 1. CloudFront - Disable distribution
aws cloudfront update-distribution \
  --id E1234567890ABC \
  --distribution-config file://backup-config.json

# 2. Route 53 - Switch to maintenance page
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

### 5. Infrastructure Rollback (Terraform)

**When to use:** Infrastructure configuration issues, network problems

**Time to complete:** ~10-30 minutes

```bash
# 1. Navigate to terraform directory
cd infrastructure/terraform/production

# 2. Review what will change
terraform plan -target=module.ecs

# 3. Apply previous state
terraform apply -target=module.ecs -var-file=previous-values.tfvars

# Or use state rollback
# 4. List state versions
terraform state list

# 5. Import previous state if needed
terraform import aws_ecs_service.main arn:aws:ecs:...
```

---

## Rollback Verification

After any rollback, verify:

### Health Checks

```bash
# Run smoke tests
npm run test:smoke -- --env=production

# Check endpoint health
curl -s https://api.skillancer.com/health | jq

# Verify key flows
curl -s https://skillancer.com | grep -q "Skillancer" && echo "Web OK"
curl -s https://api.skillancer.com/health | grep -q "healthy" && echo "API OK"
```

### Metrics Verification

- [ ] Error rate returned to baseline (<0.1%)
- [ ] Response times normal (<200ms p95)
- [ ] Database connections stable
- [ ] Memory/CPU within normal range
- [ ] No new error patterns in logs

### User Impact Assessment

- [ ] Check support ticket volume
- [ ] Review recent user feedback
- [ ] Verify payment processing working
- [ ] Confirm email sending operational

---

## Post-Rollback Actions

### Immediate (within 1 hour)

1. Update status page with resolution
2. Notify stakeholders of rollback
3. Preserve logs and metrics for investigation
4. Document timeline of events
5. Begin root cause analysis

### Same Day

1. Complete incident report
2. Schedule post-mortem meeting
3. Identify prevention measures
4. Plan fix and re-deployment strategy

### Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

**Date:** [Date]
**Duration:** [Start] - [End]
**Severity:** P[0-3]
**Author:** [Name]

## Summary

[2-3 sentence summary of what happened]

## Timeline

| Time (UTC) | Event                |
| ---------- | -------------------- |
| HH:MM      | Issue first detected |
| HH:MM      | Rollback initiated   |
| HH:MM      | Service restored     |

## Root Cause

[Detailed technical explanation]

## Impact

- Users affected: X
- Revenue impact: $X
- Data affected: [Yes/No]

## What Went Well

-
-

## What Went Wrong

-
-

## Action Items

| Action | Owner | Due Date |
| ------ | ----- | -------- |
|        |       |          |

## Lessons Learned

-
```

---

## Emergency Contacts

| Role              | Name | Phone | Availability               |
| ----------------- | ---- | ----- | -------------------------- |
| On-call Primary   |      |       | 24/7                       |
| On-call Secondary |      |       | 24/7                       |
| CTO               |      |       | Escalation                 |
| Database Admin    |      |       | Escalation                 |
| AWS TAM           |      |       | Business hours + emergency |

---

## Appendix: Quick Reference

### Version Information

```bash
# Current production version
kubectl get deployment skillancer-api -n production \
  -o jsonpath='{.spec.template.spec.containers[0].image}'

# Previous known-good versions
# v1.0.0-rc.5 - Last stable before launch
# v1.0.0-rc.4 - Two releases back
# v1.0.0-rc.3 - Three releases back
```

### Backup Information

- **Database:** Automated snapshots every hour, retained 7 days
- **Point-in-time:** Available for last 7 days
- **S3 Files:** Versioning enabled, 30-day retention
- **Configuration:** Stored in Doppler with audit trail

### Runbook Links

- [Incident Response](./incident-response.md)
- [Database Operations](./database-operations.md)
- [Deployment Procedures](./deployment.md)
- [Security Incident](./security-incident.md)
