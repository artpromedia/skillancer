# Maintenance Runbooks

Regular maintenance procedures to keep Skillancer running smoothly.

## Available Runbooks

| Runbook                              | Description                 | Frequency |
| ------------------------------------ | --------------------------- | --------- |
| [Secret Rotation](./secret-rotation) | Rotate API keys and secrets | Quarterly |
| [Scaling Services](./scaling)        | Scale services up or down   | As needed |
| [Database Maintenance](./database)   | Vacuum, reindex, backups    | Weekly    |

## Maintenance Schedule

| Task               | Frequency     | Window                 | Owner       |
| ------------------ | ------------- | ---------------------- | ----------- |
| Security patching  | Monthly       | Sunday 02:00-06:00 UTC | DevOps      |
| Database vacuum    | Weekly        | Sunday 04:00 UTC       | Automated   |
| Secret rotation    | Quarterly     | Scheduled              | Security    |
| SSL cert renewal   | Before expiry | N/A                    | Automated   |
| Dependency updates | Monthly       | N/A                    | Engineering |

## Maintenance Windows

### Standard Maintenance

- **Window**: Sundays 02:00-06:00 UTC
- **Impact**: Minimal (rolling updates)
- **Notification**: 24 hours advance

### Emergency Maintenance

- **Window**: As needed
- **Impact**: Variable
- **Notification**: ASAP via status page

## Pre-Maintenance Checklist

Before any maintenance:

- [ ] Announce in #engineering
- [ ] Update status page (if user-impacting)
- [ ] Verify backup exists
- [ ] Confirm rollback plan
- [ ] Have on-call available

## Post-Maintenance Checklist

After maintenance:

- [ ] Verify all services healthy
- [ ] Check error rates
- [ ] Update status page
- [ ] Document any issues
- [ ] Notify team of completion

## Quick Commands

### Check System Health

```bash
# All pods status
kubectl get pods -n production

# Node resources
kubectl top nodes

# Recent events
kubectl get events -n production --sort-by='.lastTimestamp' | tail -20
```

### Check Certificate Expiry

```bash
# Check TLS certificates
echo | openssl s_client -connect api.skillancer.com:443 2>/dev/null | \
  openssl x509 -noout -dates
```

### Check Dependencies

```bash
# External service status
curl -s https://status.aws.amazon.com/data.json | jq '.services[] | select(.status != "green")'
```

## Related Documentation

- [Deployment Runbooks](../deployment/)
- [Incident Runbooks](../incidents/)
- [Architecture Overview](/architecture/)
