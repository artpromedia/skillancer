# Skillancer Launch Checklist

> Last Updated: February 5, 2026
> Version: 2.0.0

This checklist covers all activities required for a successful Skillancer public launch. Complete all items in order, obtaining sign-off from the designated owner for each section.

---

## Pre-Launch Checklist

### Infrastructure

- [ ] All services deployed to production (api-gateway, notification, payment, search, SkillPod)
- [ ] Database migrations applied (PostgreSQL 15+ with read replicas)
- [ ] Redis cache configured (Redis 7+ cluster for rate limiting, sessions, feature flags)
- [ ] CDN configured for static assets (CloudFront with proper cache headers)
- [ ] SSL certificates valid and auto-renewing (>30 days validity)
- [ ] DNS configured correctly (skillancer.com, api.skillancer.com, admin.skillancer.com)
- [ ] Auto-scaling rules configured (tested at 10x expected traffic)
- [ ] Backup procedures tested (hourly snapshots, 7-day PITR, cross-region replication)

**Owner:** DevOps Lead
**Sign-off:** \***\*\_\_\_\_\*\*** Date: **\_\_\_\_**

### Security

- [ ] JWT secrets set (not development defaults)
- [ ] Encryption keys configured (stored in secrets manager, not environment files)
- [ ] CORS restricted to production domains (skillancer.com, admin.skillancer.com)
- [ ] Security headers enabled (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)
- [ ] Rate limiting active (Redis-backed via `services/api-gateway/src/plugins/rate-limit.ts`)
- [ ] npm audit passing (no critical/high vulnerabilities)
- [ ] Container scan passing (Docker images scanned for known CVEs)
- [ ] Secret scanning passing (no credentials committed to repository)
- [ ] Brute force protection verified (progressive lockout, CAPTCHA triggers)
- [ ] Webhook signature verification confirmed (Stripe and PayPal)
- [ ] WAF rules configured and tuned
- [ ] OWASP Top 10 verification completed

**Owner:** Security Lead
**Sign-off:** \***\*\_\_\_\_\*\*** Date: **\_\_\_\_**

### Monitoring

- [ ] Sentry error tracking configured (`services/api-gateway/src/plugins/sentry.ts`)
- [ ] Prometheus/Grafana monitoring active (dashboards for all services)
- [ ] Uptime monitoring configured (synthetic checks on critical endpoints)
- [ ] Alert escalation paths defined (PagerDuty integration tested)
- [ ] On-call rotation scheduled (primary and secondary, weekly rotation)
- [ ] OpenTelemetry tracing operational (`services/api-gateway/src/plugins/tracing.ts`)
- [ ] Log aggregation working (structured logging across all services)
- [ ] APM tracking enabled (response times, error rates, throughput)
- [ ] Health dashboard accessible (`/health/dashboard` endpoint)

**Owner:** SRE Lead
**Sign-off:** \***\*\_\_\_\_\*\*** Date: **\_\_\_\_**

### Integrations

- [ ] Stripe in live mode (test mode disabled, connected accounts configured)
- [ ] Stripe webhook secret configured for production endpoint
- [ ] Stripe Connect client ID set for marketplace payments
- [ ] PayPal configured for production (OAuth, orders, webhook verification)
- [ ] SendGrid/email configured for production (API key, verified sender domain)
- [ ] Firebase push notifications configured (FCM for iOS and Android)
- [ ] OAuth providers configured (Google, Microsoft, Apple)
- [ ] Meilisearch configured for production (jobs, freelancers, skills indexes)
- [ ] S3 storage configured (CORS, lifecycle policies, versioning enabled)
- [ ] Invoice PDF generation operational (Puppeteer + S3 storage)

**Owner:** Engineering Lead
**Sign-off:** \***\*\_\_\_\_\*\*** Date: **\_\_\_\_**

### Testing

- [ ] All unit tests passing (60+ service unit tests, 16+ package unit tests)
- [ ] All integration tests passing
- [ ] E2E tests passing (payment flows, search functionality, 12+ app tests)
- [ ] Load testing completed (target: 1000 concurrent users, p95 <200ms)
- [ ] Security testing completed (penetration test, dependency scan)
- [ ] Mobile app tested on iOS and Android (physical devices)
- [ ] Cross-browser testing completed (Chrome, Firefox, Safari, Edge)
- [ ] Run `pnpm launch:check --full` with all checks passing
- [ ] Smoke tests for all Moat services (executive profile, financial card, talent graph, copilot)

**Owner:** QA Lead
**Sign-off:** \***\*\_\_\_\_\*\*** Date: **\_\_\_\_**

### Business

- [ ] Terms of Service published and finalized
- [ ] Privacy Policy published
- [ ] Cookie consent configured and functional
- [ ] GDPR compliance verified (DPA ready for enterprise clients)
- [ ] Support email configured (support@skillancer.com)
- [ ] Help documentation published (FAQ, user guides, API docs)
- [ ] Support team trained on product features
- [ ] Escalation matrix defined and distributed
- [ ] Intercom/Zendesk support tools configured

**Owner:** Legal/Compliance + Support Lead
**Sign-off:** \***\*\_\_\_\_\*\*** Date: **\_\_\_\_**

### Mobile App

- [ ] iOS App Store submission prepared (Xcode signing, provisioning profiles)
- [ ] Google Play Store submission prepared (release keystore, app bundle)
- [ ] App icons and screenshots ready (all required device sizes)
- [ ] App description and metadata ready (both stores)
- [ ] Privacy policy URL configured (points to published policy)
- [ ] Flutter platform directories generated (`flutter create --platforms=android,ios .`)
- [ ] Firebase configuration files in place (google-services.json, GoogleService-Info.plist)
- [ ] Biometric authentication tested on physical devices
- [ ] Offline support verified (time tracking, data sync)
- [ ] Push notification delivery confirmed end-to-end

**Owner:** Mobile Lead
**Sign-off:** \***\*\_\_\_\_\*\*** Date: **\_\_\_\_**

---

## Launch Day Checklist

### Pre-Launch (6:00 AM UTC)

- [ ] Team on standby (all team members assembled in war room)
- [ ] Monitoring dashboards open (Grafana, Sentry, health dashboard)
- [ ] Communication channels active (#launch-war-room Slack channel)
- [ ] Status page updated: "Scheduled Maintenance"
- [ ] DNS TTLs lowered to 5 minutes (done 24 hours prior)
- [ ] Previous version tagged for rollback (`v1.0.0-rc.5`)
- [ ] Feature flags configured for kill switch capability
- [ ] Rollback procedure reviewed by on-call team

### Launch Execution (8:00 AM UTC)

- [ ] Create production backup (`./scripts/backup-production.sh`)
- [ ] Deploy production build (`./scripts/deploy-production.sh`)
- [ ] Run database migrations (`pnpm db:migrate:deploy`)
- [ ] Verify all services healthy (all pods running, health endpoints green)
- [ ] Run smoke tests (`npm run test:smoke -- --env=production`)
- [ ] DNS cutover completed (verify propagation from multiple locations)
- [ ] Enable feature flags for public access
- [ ] Status page updated: "Operational"
- [ ] Launch announcement published

### Post-Launch Monitoring (First 4 Hours)

- [ ] Monitor error rates (target: <0.1%)
- [ ] Monitor performance metrics (target: p95 <200ms)
- [ ] Database connections stable
- [ ] Memory/CPU within normal range
- [ ] No capacity or auto-scaling issues
- [ ] User registrations tracking
- [ ] Payment processing verified (test transaction in live mode)
- [ ] Email notifications delivering
- [ ] Mobile apps connecting successfully
- [ ] Support queue manageable

### Launch Day Sign-off

- [ ] All critical user flows verified
- [ ] No P0/P1 incidents
- [ ] Metrics within expectations
- [ ] Team debriefed

**Owner:** CTO
**Sign-off:** \***\*\_\_\_\_\*\*** Date: **\_\_\_\_**

---

## Post-Launch Checklist

### T+24 Hours

- [ ] Monitor error rates for 24 hours (overnight metrics reviewed)
- [ ] Check performance metrics (response times trending within SLA)
- [ ] Review user feedback (support channels, social media, app store reviews)
- [ ] Address any P0 bugs immediately
- [ ] Send launch announcement (press release, social media, email campaigns)
- [ ] Update status page (confirm "All Systems Operational")
- [ ] Error logs analyzed for recurring patterns
- [ ] Support tickets triaged and categorized

### T+48 Hours

- [ ] Quick wins identified from user feedback
- [ ] Hot fixes prioritized and scheduled
- [ ] Week 1 priorities confirmed (see `week-1-priorities.md`)
- [ ] Stakeholder report prepared and distributed
- [ ] Staging environment updated to match production
- [ ] Documentation updated with any launch learnings

---

## Success Criteria

The launch is considered successful when:

| Metric             | Target   | Actual   |
| ------------------ | -------- | -------- |
| Uptime (24h)       | 99.9%    | **\_\_** |
| P0 Incidents       | 0        | **\_\_** |
| P1 Incidents       | <2       | **\_\_** |
| Error Rate         | <0.1%    | **\_\_** |
| p95 Latency        | <200ms   | **\_\_** |
| User Registrations | >100     | **\_\_** |
| Support Tickets    | <50      | **\_\_** |
| Data Integrity     | 0 issues | **\_\_** |

---

## Emergency Contacts

| Role             | Name | Phone | Slack          |
| ---------------- | ---- | ----- | -------------- |
| Engineering Lead |      |       | @eng-lead      |
| DevOps Lead      |      |       | @devops-lead   |
| Security Lead    |      |       | @security-lead |
| Support Lead     |      |       | @support-lead  |
| Database Admin   |      |       | @dba           |
| CTO              |      |       | @cto           |

---

## Quick Reference

### Key URLs

- Production: https://skillancer.com
- API: https://api.skillancer.com
- Admin Panel: https://admin.skillancer.com
- Status Page: https://status.skillancer.com
- Grafana: https://metrics.skillancer.com

### Emergency Commands

```bash
# Disable all features (emergency kill switch)
curl -X POST https://api.skillancer.com/admin/flags/disable-all \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Enable maintenance mode
curl -X POST https://api.skillancer.com/admin/maintenance/enable \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Immediate rollback
./scripts/rollback.sh --version=v1.0.0-rc.5 --confirm
```

### Related Documents

- [Rollback Procedure](./rollback-procedure.md)
- [Incident Response Plan](./incident-response.md)
- [Rollback Plan (Detailed)](./rollback-plan.md)
- [Launch Communication Plan](./launch-communication.md)
- [Week 1 Priorities](./week-1-priorities.md)
- [Success Metrics](./success-metrics.md)

---

## Version History

| Version | Date       | Changes                                             |
| ------- | ---------- | --------------------------------------------------- |
| 1.0.0   | 2026-01-29 | Initial checklist                                   |
| 2.0.0   | 2026-02-05 | Comprehensive update with all pre-launch categories |
