# Incident Response Runbook

This runbook provides procedures for responding to incidents affecting the Skillancer platform.

## Severity Definitions

### P0 - Critical

- **Impact**: Complete outage, data loss, security breach
- **Response Time**: 15 minutes
- **Examples**:
  - Platform completely unavailable
  - Data breach or unauthorized access
  - Payment processing completely failed
  - Database corruption

### P1 - High

- **Impact**: Major feature unavailable, payments affected
- **Response Time**: 30 minutes
- **Examples**:
  - Cannot create new contracts
  - Payments delayed > 1 hour
  - SkillPod sessions failing
  - Authentication broken

### P2 - Medium

- **Impact**: Degraded performance, minor feature issues
- **Response Time**: 2 hours
- **Examples**:
  - Slow page load times (> 5s)
  - Search functionality degraded
  - Email notifications delayed
  - Non-critical API errors

### P3 - Low

- **Impact**: Cosmetic issues, non-critical bugs
- **Response Time**: Next business day
- **Examples**:
  - UI alignment issues
  - Minor copy errors
  - Edge case bugs
  - Performance not optimal but acceptable

---

## On-Call Rotation

### Primary On-Call

- **Responsibility**: First responder to all alerts
- **Response SLA**: 15 minutes for P0/P1
- **Rotation**: Weekly, Sunday 00:00 UTC
- **Contact**: PagerDuty

### Secondary On-Call

- **Responsibility**: Backup if primary unavailable
- **Escalation**: After 15 minutes without acknowledgment
- **Contact**: PagerDuty escalation policy

### Escalation Path

```
Alert Triggered
      ↓
Primary On-Call (15 min)
      ↓ (no response)
Secondary On-Call (15 min)
      ↓ (no response)
Engineering Lead
      ↓ (P0 only)
CTO
```

### Current Rotation

| Week   | Primary | Secondary |
| ------ | ------- | --------- |
| Week 1 | Team A  | Team B    |
| Week 2 | Team B  | Team C    |
| Week 3 | Team C  | Team A    |

---

## Incident Response Process

### 1. Detection & Alert

**Automated Detection:**

- Infrastructure monitoring (Grafana alerts)
- APM alerts (error rate, latency)
- Synthetic monitoring (uptime checks)

**Manual Detection:**

- Customer reports
- Internal reports
- Social media monitoring

### 2. Acknowledge & Assess

1. **Acknowledge alert** in PagerDuty
2. **Assess severity** using definitions above
3. **Create incident channel**: `#incident-YYYY-MM-DD-description`
4. **Post initial assessment**:
   ```
   🚨 INCIDENT DECLARED
   Severity: P1
   Summary: Users unable to submit proposals
   Impact: ~500 users affected
   Lead: @oncall-engineer
   Status: Investigating
   ```

### 3. Communicate

**Internal Communication:**

- Post updates to incident channel every 15 minutes
- Tag relevant stakeholders
- Use clear, factual language

**External Communication:**

- Update status page (status.skillancer.com)
- Draft customer communications if needed
- Coordinate with support team

### 4. Investigate & Mitigate

1. **Gather information**
   - Check dashboards
   - Review recent deployments
   - Examine logs
   - Query databases

2. **Identify root cause**
   - Correlate events
   - Check for patterns
   - Test hypotheses

3. **Implement fix**
   - Apply hotfix if available
   - Rollback if deployment-related
   - Scale resources if capacity issue
   - Block traffic if attack

### 5. Resolve & Verify

1. **Confirm resolution**
   - Verify metrics normalized
   - Check customer-facing functionality
   - Confirm no new errors

2. **Update status page**
   - Mark incident as resolved
   - Provide summary

3. **Stand down**
   ```
   ✅ INCIDENT RESOLVED
   Duration: 45 minutes
   Root Cause: Database connection pool exhausted
   Resolution: Increased pool size, deployed fix
   Action Items: Schedule post-mortem
   ```

---

## Communication Templates

### Status Page Update - Investigating

```
We are currently investigating reports of [brief description].
Some users may experience [impact description].
Our team is actively working on resolving this issue.
We will provide updates as we have more information.
```

### Status Page Update - Identified

```
We have identified the cause of [brief description].
Our team is implementing a fix.
Expected resolution: [time estimate].
We apologize for any inconvenience.
```

### Status Page Update - Resolved

```
The issue affecting [feature/service] has been resolved.
All services are operating normally.
We apologize for any inconvenience this may have caused.
A full post-mortem will be conducted.
```

### Customer Email - Major Incident

```
Subject: Skillancer Service Disruption - [Date]

Dear [Customer Name],

We want to inform you about a service disruption that occurred
on [date] between [time] and [time] UTC.

What happened:
[Brief, clear explanation]

Impact to you:
[Specific impact, if any]

What we're doing:
[Actions being taken]

If you experienced any issues during this time, please contact
our support team at support@skillancer.com.

We apologize for any inconvenience and appreciate your patience.

The Skillancer Team
```

### Internal Chat Announcement

```
🚨 **Incident Alert - [Severity]**

**Summary**: [One-line description]
**Impact**: [Who/what is affected]
**Status**: [Investigating/Mitigating/Resolved]
**Lead**: @[engineer]
**Channel**: #incident-YYYY-MM-DD

Updates will be posted in the incident channel.
```

---

## Post-Mortem Process

### Timeline

| Timeframe   | Action                               |
| ----------- | ------------------------------------ |
| Immediately | Create post-mortem doc from template |
| 24 hours    | Complete timeline section            |
| 48 hours    | Complete root cause analysis         |
| 72 hours    | Hold post-mortem meeting             |
| 1 week      | Action items assigned and tracked    |

### Post-Mortem Template

```markdown
# Post-Mortem: [Incident Title]

## Summary

- **Date**:
- **Duration**:
- **Severity**:
- **Lead**:

## Impact

- Users affected:
- Revenue impact:
- SLA impact:

## Timeline

| Time (UTC) | Event                 |
| ---------- | --------------------- |
| HH:MM      | First alert triggered |
| HH:MM      | Engineer acknowledged |
| HH:MM      | Root cause identified |
| HH:MM      | Fix deployed          |
| HH:MM      | Incident resolved     |

## Root Cause Analysis

[Detailed explanation of what caused the incident]

### Contributing Factors

1.
2.
3.

## Resolution

[What was done to resolve the incident]

## Action Items

| Action | Owner | Due Date | Status |
| ------ | ----- | -------- | ------ |
|        |       |          |        |

## Lessons Learned

### What went well

-

### What could be improved

-

## Appendix

- Links to relevant logs
- Graphs showing impact
- Related documentation
```

### Post-Mortem Meeting

**Attendees:**

- Incident lead
- On-call responders
- Relevant team leads
- Optional: Product, Support

**Agenda:**

1. Review timeline (10 min)
2. Discuss root cause (15 min)
3. Review response effectiveness (10 min)
4. Identify action items (15 min)
5. Assign owners and dates (10 min)

**Ground Rules:**

- Blameless culture
- Focus on systems, not individuals
- Constructive discussion
- Action-oriented outcomes

---

## Useful Commands & Queries

### Check Service Health

```bash
# Kubernetes pods status
kubectl get pods -n production

# Service logs
kubectl logs -f deployment/api-gateway -n production

# Database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"
```

### Quick Diagnosis

```bash
# Recent deployments
kubectl rollout history deployment/api-gateway

# Error rate spike
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_errors_total[5m])"

# Memory pressure
kubectl top pods -n production
```

### Emergency Actions

```bash
# Rollback deployment
kubectl rollout undo deployment/api-gateway

# Scale up
kubectl scale deployment/api-gateway --replicas=10

# Enable maintenance mode
./scripts/maintenance-mode.sh enable
```

---

## Contacts

### Internal

| Role             | Contact              |
| ---------------- | -------------------- |
| Engineering Lead | @eng-lead (Chat)     |
| CTO              | @cto (Chat)          |
| Security Lead    | @security (Chat)     |
| Support Lead     | @support-lead (Chat) |

### External

| Service     | Contact                       |
| ----------- | ----------------------------- |
| AWS Support | AWS Console / Premium Support |
| Stripe      | dashboard.stripe.com/support  |
| PagerDuty   | support.pagerduty.com         |
| Cloudflare  | support.cloudflare.com        |
