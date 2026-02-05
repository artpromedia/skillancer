# Skillancer Incident Response Plan

> Last Updated: February 5, 2026
> Version: 1.0.0

This document defines how the Skillancer team detects, responds to, communicates about, and learns from production incidents. All team members with on-call responsibilities must read and understand this plan.

---

## Table of Contents

1. [Severity Levels](#severity-levels)
2. [Escalation Paths](#escalation-paths)
3. [Incident Response Process](#incident-response-process)
4. [Communication Templates](#communication-templates)
5. [Post-Mortem Process](#post-mortem-process)
6. [Useful Commands and Queries](#useful-commands-and-queries)
7. [Contacts](#contacts)

---

## Severity Levels

### P0 - Critical

- **Impact:** Complete outage, data loss, security breach, or total payment processing failure
- **Response Time:** 15 minutes
- **Resolution Target:** 1 hour
- **Notification:** Entire engineering team, CTO, Support Lead
- **Examples:**
  - Platform completely unavailable (all services down)
  - Data breach or unauthorized access to user data
  - Payment processing completely failed across Stripe and PayPal
  - Database corruption or data loss
  - Security vulnerability actively being exploited
  - All user authentication broken

### P1 - High

- **Impact:** Major feature unavailable, significant degradation affecting >25% of users
- **Response Time:** 30 minutes
- **Resolution Target:** 4 hours
- **Notification:** On-call team, Engineering Lead, affected service owners
- **Examples:**
  - Cannot create new contracts or proposals
  - Payments delayed more than 1 hour
  - SkillPod sessions failing for all users
  - Authentication broken for one provider (e.g., Google OAuth down)
  - Search functionality completely unavailable
  - Email notifications not sending
  - Mobile app unable to connect to API

### P2 - Medium

- **Impact:** Degraded performance or minor feature unavailable, affecting <25% of users
- **Response Time:** 2 hours
- **Resolution Target:** 24 hours
- **Notification:** On-call team, relevant service owner
- **Examples:**
  - Slow page load times (>3 seconds, but functional)
  - Search results degraded (returning partial results)
  - Email notifications delayed by more than 30 minutes
  - Non-critical API errors on specific endpoints
  - Invoice PDF generation slow or intermittently failing
  - Push notifications delayed
  - Recommendation engine returning stale results

### P3 - Low

- **Impact:** Cosmetic issues, non-critical bugs, minor inconveniences
- **Response Time:** Next business day
- **Resolution Target:** Next sprint
- **Notification:** Logged in issue tracker, assigned to relevant team
- **Examples:**
  - UI alignment or styling issues
  - Minor copy or translation errors
  - Edge case bugs affecting <1% of users
  - Performance below target but within acceptable range
  - Non-critical admin panel issues
  - Analytics data delayed

### Severity Quick Reference

| Severity | Response Time     | Resolution Target | Who to Page           | Rollback?        |
| -------- | ----------------- | ----------------- | --------------------- | ---------------- |
| P0       | 15 min            | 1 hour            | All engineering + CTO | Yes              |
| P1       | 30 min            | 4 hours           | On-call + Lead        | Consider         |
| P2       | 2 hours           | 24 hours          | On-call               | No (fix forward) |
| P3       | Next business day | Next sprint       | Assign ticket         | No               |

---

## Escalation Paths

### Primary Escalation Chain

```
Alert Triggered (PagerDuty / Grafana / Sentry)
        |
        v
Primary On-Call Engineer (15 min to acknowledge)
        |
        | (no response after 15 min)
        v
Secondary On-Call Engineer (15 min to acknowledge)
        |
        | (no response after 15 min, or P0 incident)
        v
Engineering Lead
        |
        | (P0 only, or if unresolved after 30 min)
        v
CTO
```

### Domain-Specific Escalation

For issues requiring specialized knowledge, escalate directly to the relevant domain owner alongside the primary chain:

| Issue Domain                     | Primary Escalation         | Secondary Escalation |
| -------------------------------- | -------------------------- | -------------------- |
| Payment failures (Stripe/PayPal) | Billing/Payment Lead       | Engineering Lead     |
| Database issues                  | Database Admin             | DevOps Lead          |
| Security incidents               | Security Lead              | CTO                  |
| Infrastructure/Kubernetes        | DevOps Lead                | Engineering Lead     |
| Mobile app issues                | Mobile Lead                | Engineering Lead     |
| Search/Meilisearch               | Search Service Owner       | Engineering Lead     |
| SkillPod sessions                | SkillPod Service Owner     | Engineering Lead     |
| Email/Notifications              | Notification Service Owner | Engineering Lead     |

### On-Call Rotation

| Week   | Primary On-Call | Secondary On-Call |
| ------ | --------------- | ----------------- |
| Week 1 | Team A          | Team B            |
| Week 2 | Team B          | Team C            |
| Week 3 | Team C          | Team A            |

**Rotation schedule:** Weekly, Sunday 00:00 UTC
**Contact method:** PagerDuty
**Escalation timeout:** 15 minutes without acknowledgment

### On-Call Responsibilities

- Acknowledge all alerts within 15 minutes (P0/P1) or 2 hours (P2)
- Assess severity and declare incident if warranted
- Coordinate response and communicate status
- Engage additional responders as needed
- Ensure incident channel is created and timeline is maintained
- Hand off cleanly at rotation boundaries

---

## Incident Response Process

### Phase 1: Detection and Alert

**Automated Detection Sources:**

| Source             | What It Detects                                 | Alert Channel     |
| ------------------ | ----------------------------------------------- | ----------------- |
| Grafana/Prometheus | Error rate spikes, latency, resource exhaustion | PagerDuty         |
| Sentry             | Application errors, unhandled exceptions        | PagerDuty + Slack |
| Kubernetes         | Pod crashes, health check failures              | PagerDuty         |
| Uptime monitors    | Endpoint availability                           | PagerDuty + Slack |
| CloudWatch         | AWS resource alarms (RDS, ElastiCache, S3)      | PagerDuty         |

**Manual Detection Sources:**

- Customer support reports
- Internal team reports
- Social media monitoring
- App store reviews

### Phase 2: Acknowledge and Assess

1. **Acknowledge the alert** in PagerDuty (stops escalation timer)
2. **Assess severity** using the definitions above
3. **Declare an incident** if severity is P0 or P1
4. **Create an incident channel** in Slack: `#incident-YYYY-MM-DD-<brief-description>`
5. **Post the initial assessment** (use template below)
6. **Assign roles:**
   - **Incident Commander (IC):** Coordinates response, makes decisions, communicates status
   - **Technical Lead:** Investigates root cause, implements fix
   - **Communications Lead:** Updates status page, drafts customer comms

### Phase 3: Investigate and Mitigate

1. **Gather information**
   - Check Grafana dashboards for anomalies
   - Review Sentry for new or spiking errors
   - Check recent deployments (`kubectl rollout history`)
   - Examine application logs (`kubectl logs`)
   - Query database metrics (connections, slow queries)
   - Check external service status (Stripe, AWS, SendGrid)

2. **Identify the root cause**
   - Correlate the incident timeline with deployment history
   - Check for pattern changes in error types
   - Test hypotheses systematically
   - Document findings in the incident channel

3. **Implement mitigation**
   - **Feature flag toggle:** Disable the problematic feature (30 seconds)
   - **Hotfix deployment:** Deploy a targeted fix (10-30 minutes)
   - **Service rollback:** Revert to previous version (5 minutes, see [Rollback Procedure](./rollback-procedure.md))
   - **Database rollback:** Revert schema or data changes (10-60 minutes)
   - **Scale resources:** Add capacity if the issue is load-related
   - **Block traffic:** Enable WAF rules if under attack

### Phase 4: Resolve and Verify

1. **Confirm resolution**
   - Verify metrics have returned to normal
   - Run smoke tests against production
   - Check that customer-facing functionality is restored
   - Confirm no new errors in Sentry

2. **Update status page** to "Resolved"

3. **Post resolution notice** in the incident channel (use template below)

4. **Continue monitoring** for at least 1 hour after resolution

### Phase 5: Follow Up

1. Create a post-mortem document from the template (within 24 hours)
2. Schedule a post-mortem meeting (within 72 hours)
3. Assign and track action items
4. Update runbooks if the response process revealed gaps

---

## Communication Templates

### Incident Declaration (Slack - Internal)

```
INCIDENT DECLARED

Severity: P[0/1/2]
Summary: [One-line description of the problem]
Impact: [Who is affected and how - e.g., "~500 users unable to submit proposals"]
Detection: [How it was detected - alert / customer report / internal]
Incident Commander: @[engineer-name]
Technical Lead: @[engineer-name]
Status: Investigating

Channel: #incident-YYYY-MM-DD-description
Status Page: [Updated / Pending]
```

### Status Update (Slack - Internal, Every 15 Minutes)

```
INCIDENT UPDATE - [HH:MM UTC]

Severity: P[0/1/2]
Status: [Investigating / Identified / Mitigating / Monitoring / Resolved]
Summary: [Current understanding of the issue]
Actions Taken: [What has been done since the last update]
Next Steps: [What is being done next]
ETA: [Estimated time to resolution, or "Unknown"]
```

### Incident Resolved (Slack - Internal)

```
INCIDENT RESOLVED - [HH:MM UTC]

Severity: P[0/1/2]
Duration: [Total incident duration]
Summary: [What happened]
Root Cause: [Brief root cause, or "To be determined in post-mortem"]
Resolution: [How it was fixed]
Impact: [Users affected, data impact, revenue impact if known]

Next Steps:
- Continue monitoring for [X hours]
- Post-mortem document to be created within 24 hours
- Post-mortem meeting scheduled for [date/time]

Action Items:
- [ ] [Immediate follow-up action 1]
- [ ] [Immediate follow-up action 2]
```

### Status Page - Investigating

```
We are currently investigating reports of [brief description of the issue].
Some users may experience [specific impact - e.g., "errors when submitting proposals"
or "slower than normal page load times"].
Our engineering team is actively working on identifying and resolving this issue.
We will provide updates as we have more information.
```

### Status Page - Identified

```
We have identified the cause of [brief description].
Our team is implementing a fix.
Expected resolution time: [time estimate].
We apologize for any inconvenience.
```

### Status Page - Monitoring

```
A fix has been implemented for [brief description].
We are currently monitoring the platform to ensure the issue is fully resolved.
Some users may still experience brief intermittent issues as the fix propagates.
We will provide a final update once we have confirmed full resolution.
```

### Status Page - Resolved

```
The issue affecting [feature/service] has been resolved as of [time] UTC.
All Skillancer services are now operating normally.
We apologize for any inconvenience this may have caused.
A thorough review is being conducted to prevent similar issues in the future.
```

### Customer Email - Major Incident (P0/P1 with >30 Minutes Downtime)

```
Subject: Skillancer Service Update - [Date]

Dear [Customer Name],

We want to inform you about a service disruption that occurred on [date]
between [start time] and [end time] UTC.

What happened:
[Brief, clear, non-technical explanation of what went wrong]

Impact to you:
[Specific impact description. For example:
- "Your work and data were not affected."
- "Any contracts created during this window have been preserved."
- "Payments initiated during this period may be delayed but will be processed."]

What we did:
[Brief description of the resolution - e.g., "Our team identified and resolved
a configuration issue that was preventing access to the platform."]

What we are doing to prevent this:
[Concrete preventive measures - e.g., "We are implementing additional automated
checks and monitoring to detect and prevent similar issues before they affect users."]

If you experienced any issues during this time or have questions, please
contact our support team at support@skillancer.com.

We sincerely apologize for any inconvenience and appreciate your patience.

Best regards,
The Skillancer Team
```

### Executive Notification (Internal, for P0 Only)

```
Subject: [P0 INCIDENT] Skillancer - [Brief Description]

Current Status: [Investigating / Mitigating / Resolved]
Started: [Time UTC]
Duration: [Ongoing / Total duration]

Summary:
[2-3 sentence summary of the issue and impact]

Customer Impact:
- Users affected: [Number or percentage]
- Revenue impact: [Estimated or "being assessed"]
- Data impact: [Yes/No, with details]

Current Actions:
[What the team is doing right now]

Next Update: [Time of next expected update]

Incident Channel: #incident-YYYY-MM-DD-description
Status Page: https://status.skillancer.com
```

---

## Post-Mortem Process

### Purpose

Post-mortems exist to understand what happened, why it happened, and how to prevent it from happening again. They are conducted in a **blameless** culture focused on systems and processes rather than individuals.

### Timeline

| Timeframe                    | Action                                              | Responsible        |
| ---------------------------- | --------------------------------------------------- | ------------------ |
| Immediately after resolution | Create post-mortem document from template           | Incident Commander |
| Within 24 hours              | Complete the timeline and impact sections           | Incident Commander |
| Within 48 hours              | Complete root cause analysis                        | Technical Lead     |
| Within 72 hours              | Hold post-mortem meeting                            | Incident Commander |
| Within 1 week                | All action items assigned, tracked, and in progress | Engineering Lead   |
| Within 2 weeks               | Verify preventive measures are implemented          | Engineering Lead   |

### Post-Mortem Document Template

```markdown
# Post-Mortem: [Incident Title]

## Metadata

| Field              | Value                         |
| ------------------ | ----------------------------- |
| Date               | [YYYY-MM-DD]                  |
| Duration           | [Start time] - [End time] UTC |
| Severity           | P[0/1/2]                      |
| Incident Commander | [Name]                        |
| Author             | [Name]                        |
| Status             | [Draft / Reviewed / Final]    |

## Executive Summary

[2-3 sentence summary of what happened, the impact, and how it was resolved.]

## Impact

| Metric                    | Value                  |
| ------------------------- | ---------------------- |
| Users affected            | [Number or percentage] |
| Duration of impact        | [Time]                 |
| Revenue impact            | [$X or "None"]         |
| Data loss                 | [Yes/No - details]     |
| SLA impact                | [Yes/No - details]     |
| Support tickets generated | [Number]               |

## Timeline

All times in UTC.

| Time  | Event                                                            |
| ----- | ---------------------------------------------------------------- |
| HH:MM | [First signs of the issue - e.g., "Error rate began increasing"] |
| HH:MM | [Alert triggered in PagerDuty/Grafana]                           |
| HH:MM | [On-call engineer acknowledged]                                  |
| HH:MM | [Incident declared, channel created]                             |
| HH:MM | [Investigation began]                                            |
| HH:MM | [Root cause identified]                                          |
| HH:MM | [Mitigation applied - e.g., "Rolled back to v1.0.0-rc.5"]        |
| HH:MM | [Service restored, monitoring began]                             |
| HH:MM | [Incident declared resolved]                                     |

## Root Cause Analysis

### What happened

[Detailed technical explanation of the root cause. Include relevant code paths,
configuration changes, or infrastructure details.]

### Why it happened

[Explain the chain of events that led to the incident. Use the "5 Whys" technique
to dig into the underlying causes.]

1. Why did the service fail? [Answer]
2. Why did [Answer 1] happen? [Answer]
3. Why did [Answer 2] happen? [Answer]
4. Why did [Answer 3] happen? [Answer]
5. Why did [Answer 4] happen? [Answer - this is usually the systemic root cause]

### Contributing factors

1. [Factor 1 - e.g., "Missing integration test for this code path"]
2. [Factor 2 - e.g., "Alert threshold was too high to catch early"]
3. [Factor 3 - e.g., "Rollback procedure was not recently tested"]

## Resolution

[Detailed explanation of what was done to resolve the incident.]

## Detection

| Question                          | Answer                               |
| --------------------------------- | ------------------------------------ |
| How was it detected?              | [Alert / Customer report / Internal] |
| How long before detection?        | [Time from start to first alert]     |
| Could we have detected it sooner? | [Yes/No - how?]                      |

## Response Assessment

### What went well

- [Example: "Alert fired within 2 minutes of the issue starting"]
- [Example: "Rollback procedure worked smoothly"]
- [Example: "Communication was timely and clear"]

### What could be improved

- [Example: "Took 15 minutes to identify which service was affected"]
- [Example: "Status page was not updated promptly"]
- [Example: "Runbook was missing steps for this specific scenario"]

## Action Items

| Priority | Action                                    | Owner  | Due Date | Status      | Ticket |
| -------- | ----------------------------------------- | ------ | -------- | ----------- | ------ |
| P0       | [Immediate fix to prevent recurrence]     | [Name] | [Date]   | [Open/Done] | [Link] |
| P1       | [Improve detection for this failure mode] | [Name] | [Date]   | [Open/Done] | [Link] |
| P1       | [Add missing test coverage]               | [Name] | [Date]   | [Open/Done] | [Link] |
| P2       | [Update runbook with new procedure]       | [Name] | [Date]   | [Open/Done] | [Link] |
| P2       | [Adjust alert thresholds]                 | [Name] | [Date]   | [Open/Done] | [Link] |

## Lessons Learned

[Key takeaways that the team should internalize for future incident prevention
and response.]

## Appendix

- [Link to Grafana dashboard during incident]
- [Link to Sentry error group]
- [Link to relevant logs]
- [Link to deployment that caused the issue]
- [Screenshot of metrics during the incident]
```

### Post-Mortem Meeting

**Schedule:** Within 72 hours of incident resolution

**Attendees:**

- Incident Commander (required)
- Technical Lead / responders (required)
- Relevant service owners (required)
- Engineering Lead (required for P0/P1)
- Product Manager (optional)
- Support Lead (optional, for customer-facing incidents)

**Agenda (60 minutes):**

1. **Review timeline** (10 minutes) - Walk through the sequence of events
2. **Discuss root cause** (15 minutes) - Technical deep dive
3. **Review detection and response** (10 minutes) - What went well, what could improve
4. **Identify action items** (15 minutes) - Concrete preventive measures
5. **Assign owners and due dates** (10 minutes) - Ensure accountability

**Ground Rules:**

- **Blameless:** Focus on systems and processes, not individuals
- **Constructive:** Propose solutions, not just problems
- **Factual:** Base discussion on data and timeline, not assumptions
- **Action-oriented:** Every discussion point should lead to a concrete action item or a documented decision
- **No spectators:** Everyone in the meeting is expected to contribute

### Post-Mortem Review Cycle

Post-mortem action items are reviewed weekly in the engineering stand-up until all are completed. For P0 incidents, a 30-day follow-up review is conducted to verify that preventive measures are effective.

---

## Useful Commands and Queries

### Check Service Health

```bash
# All pods status
kubectl get pods -n production

# Specific service logs (last 100 lines, follow)
kubectl logs -f --tail=100 deployment/skillancer-api -n production

# Health endpoint
curl -sf https://api.skillancer.com/health | jq

# Health dashboard
curl -sf https://api.skillancer.com/health/dashboard | jq
```

### Quick Diagnosis

```bash
# Recent deployments
kubectl rollout history deployment/skillancer-api -n production

# Error rate (Prometheus query)
curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])"

# Resource usage
kubectl top pods -n production
kubectl top nodes

# Database connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Redis status
redis-cli -h $REDIS_HOST info clients
redis-cli -h $REDIS_HOST info memory
```

### Emergency Actions

```bash
# Rollback a deployment
kubectl rollout undo deployment/skillancer-api -n production

# Scale up a service
kubectl scale deployment/skillancer-api --replicas=10 -n production

# Enable maintenance mode
curl -X POST https://api.skillancer.com/admin/maintenance/enable \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Disable a feature flag
curl -X POST https://api.skillancer.com/admin/flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"flag": "<flag_name>", "enabled": false}'

# Kill switch - disable all features
curl -X POST https://api.skillancer.com/admin/flags/disable-all \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Full rollback script
./scripts/rollback.sh --environment=production --version=<version> --confirm
```

---

## Contacts

### Internal

| Role             | Name | Slack          | PagerDuty       |
| ---------------- | ---- | -------------- | --------------- |
| Engineering Lead |      | @eng-lead      | Yes             |
| DevOps Lead      |      | @devops-lead   | Yes             |
| Security Lead    |      | @security-lead | Yes             |
| Database Admin   |      | @dba           | Yes             |
| Mobile Lead      |      | @mobile-lead   | Yes             |
| Support Lead     |      | @support-lead  | No              |
| CTO              |      | @cto           | Escalation only |

### External Services

| Service     | Status Page                 | Support Contact               |
| ----------- | --------------------------- | ----------------------------- |
| AWS         | status.aws.amazon.com       | AWS Console / Premium Support |
| Stripe      | status.stripe.com           | dashboard.stripe.com/support  |
| PayPal      | developer.paypal.com/status | PayPal Developer Support      |
| SendGrid    | status.sendgrid.com         | support.sendgrid.com          |
| PagerDuty   | status.pagerduty.com        | support.pagerduty.com         |
| Meilisearch |                             | Self-hosted (internal)        |
| Firebase    | status.firebase.google.com  | Firebase Console Support      |

---

## Related Documents

- [Launch Checklist](./launch-checklist.md)
- [Rollback Procedure](./rollback-procedure.md)
- [Rollback Plan (Detailed Technical)](./rollback-plan.md)
- [Database Operations Runbook](../runbooks/database-operations.md)
- [Security Incident Runbook](../runbooks/security-incident.md)
- [Deployment Runbook](../deployment-runbook.md)
- [Scaling Runbook](../runbooks/scaling.md)
- [Support Escalation Matrix](../support/escalation-matrix.md)
