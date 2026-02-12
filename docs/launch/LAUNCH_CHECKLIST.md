# 🚀 Skillancer Production Launch Checklist

> Last Updated: January 29, 2026
> Version: 1.0.0

## Pre-Launch (T-7 Days)

### Infrastructure

- [ ] AWS/Cloud resources provisioned and configured
- [ ] Kubernetes cluster ready with proper node sizing
- [ ] Load balancers configured with SSL certificates
- [ ] CDN (CloudFront) configured for static assets
- [ ] DNS records prepared (not yet pointed)
- [ ] Database cluster provisioned with read replicas
- [ ] Redis cluster provisioned with proper sizing
- [ ] S3 buckets created with CORS and lifecycle policies

### Security

- [ ] SSL certificates obtained and validated
- [ ] WAF rules configured
- [ ] DDoS protection enabled
- [ ] Secrets rotated and stored in secrets manager
- [ ] Security audit completed
- [ ] Penetration testing completed
- [ ] GDPR/compliance review completed

### Monitoring

- [ ] Sentry error tracking configured
- [ ] Datadog/CloudWatch dashboards created
- [ ] Alert rules configured (PagerDuty/OpsGenie)
- [ ] Log aggregation configured (CloudWatch/ELK)
- [ ] Uptime monitoring configured (Pingdom/UptimeRobot)

## Pre-Launch (T-3 Days)

### Code Freeze

- [ ] Feature freeze enacted
- [ ] Only critical bug fixes allowed
- [ ] All PRs reviewed and merged
- [ ] Main branch stable

### Testing

- [ ] Run `pnpm launch:check --full`
- [ ] E2E tests passing in staging
- [ ] Performance tests completed
- [ ] Load testing completed (target: 1000 concurrent users)
- [ ] Mobile app tested on physical devices

### Data

- [ ] Database migrations tested on staging
- [ ] Seed data prepared for production
- [ ] Backup and restore procedures tested
- [ ] Data migration scripts tested (if applicable)

### Documentation

- [ ] API documentation published
- [ ] User documentation ready
- [ ] Support team trained
- [ ] Runbooks updated

## Launch Day (T-0)

### Pre-Deployment (Morning)

- [ ] Team standup and launch briefing
- [ ] All team members on-call and available
- [ ] Communication channels ready (Team Chat, Status page)
- [ ] Customer support prepared

### Deployment

```bash
# 1. Final staging verification
pnpm launch:check --full

# 2. Create production backup
./scripts/backup-production.sh

# 3. Deploy infrastructure changes (if any)
cd infrastructure/terraform
terraform apply

# 4. Deploy services
./scripts/deploy-production.sh

# 5. Run database migrations
pnpm db:migrate:deploy

# 6. Verify health endpoints
curl https://api.skillancer.com/health/dashboard
```

### Post-Deployment Verification

- [ ] Health check dashboard green
- [ ] API documentation accessible at /docs
- [ ] Authentication flow working
- [ ] Payment processing working (test transaction)
- [ ] Email notifications working
- [ ] Mobile apps connecting successfully

### DNS Cutover

- [ ] Update DNS records to point to production
- [ ] Verify propagation (use multiple DNS checkers)
- [ ] Test from multiple locations/networks

### Monitoring

- [ ] Error rate normal (< 0.1%)
- [ ] Response times acceptable (< 200ms p95)
- [ ] No memory leaks detected
- [ ] Database connections stable

## Post-Launch (T+1 Hour)

### Verification

- [ ] Real user traffic flowing
- [ ] No critical errors in Sentry
- [ ] Metrics within expected ranges
- [ ] Support channels monitored

### Communication

- [ ] Status page updated to "Operational"
- [ ] Launch announcement published
- [ ] Social media posts scheduled

## Post-Launch (T+24 Hours)

### Review

- [ ] Incident report (if any issues)
- [ ] Performance review meeting
- [ ] User feedback collected
- [ ] Metrics baseline established

### Cleanup

- [ ] Staging environment updated
- [ ] Development environment refreshed
- [ ] Documentation updated with learnings

---

## Emergency Contacts

| Role         | Name | Phone | Email |
| ------------ | ---- | ----- | ----- |
| Tech Lead    | TBD  | TBD   | TBD   |
| DevOps       | TBD  | TBD   | TBD   |
| Product      | TBD  | TBD   | TBD   |
| Support Lead | TBD  | TBD   | TBD   |

## Rollback Procedure

If critical issues are detected:

```bash
# 1. Switch traffic to maintenance page
kubectl apply -f infrastructure/kubernetes/maintenance-mode.yaml

# 2. Rollback to previous version
./scripts/rollback.sh --version=<previous-version>

# 3. Verify rollback
curl https://api.skillancer.com/health

# 4. Restore traffic
kubectl delete -f infrastructure/kubernetes/maintenance-mode.yaml

# 5. Communicate to users
# Update status page and notify support
```

## Success Criteria

Launch is considered successful when:

1. ✅ All services healthy for 1 hour
2. ✅ Error rate < 0.5%
3. ✅ P95 response time < 500ms
4. ✅ Zero data integrity issues
5. ✅ User registrations working
6. ✅ Payment processing working
7. ✅ No critical security alerts

---

## Version History

| Version | Date       | Changes           |
| ------- | ---------- | ----------------- |
| 1.0.0   | 2026-01-29 | Initial checklist |
