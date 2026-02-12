# Runbooks

Runbooks provide step-by-step procedures for common operational tasks and incident response. These guides help maintain consistent operations across the team.

## Categories

### 🚀 [Deployment](./deployment/)

Procedures for deploying and releasing Skillancer services.

- [Production Deployment](./deployment/production) - Deploy to production
- [Rollback Procedures](./deployment/rollback) - Revert problematic deployments
- [Database Migrations](./deployment/migrations) - Run and manage migrations

### 🚨 [Incident Response](./incidents/)

Guides for responding to production incidents.

- [High Error Rate](./incidents/high-error-rate) - When error rates spike
- [Database Issues](./incidents/database-issues) - Database performance problems
- [Service Down](./incidents/service-down) - Complete service outages

### 🔧 [Maintenance](./maintenance/)

Regular maintenance procedures.

- [Secret Rotation](./maintenance/secret-rotation) - Rotate API keys and secrets
- [Scaling Services](./maintenance/scaling) - Scale services up or down
- [Database Maintenance](./maintenance/database) - Vacuum, reindex, backups

## Quick Reference

### Emergency Contacts

| Role             | Contact         | Escalation               |
| ---------------- | --------------- | ------------------------ |
| On-Call Engineer | Check PagerDuty | Auto-escalates after 15m |
| Engineering Lead | @eng-lead       | Direct Message           |
| DevOps           | @devops         | #devops channel          |
| Security         | @security       | #security channel        |

### Important Links

| Resource    | URL                                |
| ----------- | ---------------------------------- |
| AWS Console | `https://console.aws.amazon.com`   |
| Grafana     | `https://grafana.skillancer.com`   |
| PagerDuty   | `https://skillancer.pagerduty.com` |
| Status Page | `https://status.skillancer.com`    |

### Service Health Endpoints

```bash
# Check service health
curl https://api.skillancer.com/user/health
curl https://api.skillancer.com/project/health
curl https://api.skillancer.com/booking/health
curl https://api.skillancer.com/payment/health
```

## Runbook Standards

Each runbook follows this structure:

1. **Overview**: What this runbook addresses
2. **Prerequisites**: What you need before starting
3. **Procedure**: Step-by-step instructions
4. **Verification**: How to confirm success
5. **Rollback**: How to undo if needed
6. **Troubleshooting**: Common issues and solutions

## Contributing

When creating or updating runbooks:

1. Test procedures in staging first
2. Include all command outputs
3. Document failure modes
4. Get peer review before merging
5. Update last-verified date

---

> ⚠️ **Important**: Always verify you're in the correct environment before running commands. Production commands should be double-checked.
