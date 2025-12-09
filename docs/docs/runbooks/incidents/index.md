# Incident Response Runbooks

Guides for responding to production incidents quickly and effectively.

## Available Runbooks

| Runbook                              | Description                       | Severity |
| ------------------------------------ | --------------------------------- | -------- |
| [High Error Rate](./high-error-rate) | Error rates spike above threshold | P1-P2    |
| [Database Issues](./database-issues) | Database performance problems     | P1-P2    |
| [Service Down](./service-down)       | Complete service outage           | P1       |

## Incident Severity Levels

| Level | Description | Response Time | Examples                             |
| ----- | ----------- | ------------- | ------------------------------------ |
| P1    | Critical    | < 15 min      | Complete outage, data loss           |
| P2    | Major       | < 30 min      | Partial outage, degraded performance |
| P3    | Minor       | < 4 hours     | Non-critical feature broken          |
| P4    | Low         | < 24 hours    | Cosmetic issues, minor bugs          |

## Incident Response Process

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Incident Response Flow                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────────┐  │
│  │ Detect  │───▶│ Triage  │───▶│ Respond │───▶│    Resolve      │  │
│  │         │    │         │    │         │    │                 │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────────────┘  │
│       │              │              │                   │           │
│       ▼              ▼              ▼                   ▼           │
│   Alert fires    Assess        Execute          Post-mortem        │
│   Page on-call   severity      runbook          Document           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Reference

### Start Incident Response

```bash
# 1. Acknowledge alert in PagerDuty
# 2. Join #incidents channel
# 3. Post incident start:
```

Template:

```
🚨 INCIDENT STARTED
- Time: [timestamp]
- Service: [affected service]
- Symptoms: [brief description]
- Impact: [user impact]
- Investigating: @[your-name]
```

### Get Current Status

```bash
# Check all services
kubectl get pods -n production

# Check recent events
kubectl get events -n production --sort-by='.lastTimestamp' | tail -20

# Check error rates (via CLI)
curl -s "https://api.skillancer.com/metrics" | grep error_rate
```

### Communication Templates

**Status Update:**

```
📊 INCIDENT UPDATE [HH:MM]
- Status: Investigating / Identified / Monitoring / Resolved
- Current action: [what you're doing]
- ETA: [if known]
```

**Resolution:**

```
✅ INCIDENT RESOLVED
- Duration: [X hours Y minutes]
- Root cause: [brief description]
- Resolution: [what fixed it]
- Follow-up: [ticket number for post-mortem]
```

## On-Call Responsibilities

### Primary On-Call

- First responder to all alerts
- Acknowledge within 5 minutes (P1/P2)
- Escalate if unable to resolve in 30 minutes

### Secondary On-Call

- Backup for primary
- Assists with P1 incidents
- Takes over if primary unavailable

### Escalation Path

1. Primary On-Call (immediate)
2. Secondary On-Call (after 15 min)
3. Engineering Lead (after 30 min for P1)
4. CTO (major customer impact)

## Key Dashboards

| Dashboard        | URL                                                  | Purpose             |
| ---------------- | ---------------------------------------------------- | ------------------- |
| Service Overview | [Grafana](https://grafana.skillancer.com/d/services) | All services status |
| Error Rates      | [Grafana](https://grafana.skillancer.com/d/errors)   | Error tracking      |
| Database         | [Grafana](https://grafana.skillancer.com/d/postgres) | DB performance      |
| Kubernetes       | [Grafana](https://grafana.skillancer.com/d/k8s)      | Cluster health      |

## Related Documentation

- [Deployment Runbooks](../deployment/)
- [Maintenance Runbooks](../maintenance/)
- [Architecture Overview](/architecture/)
