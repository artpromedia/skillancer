# Production Security Checklist

Complete this checklist before going live. All items must be verified and documented.

## Infrastructure

### Secrets Management

- [ ] All secrets stored in AWS Secrets Manager
- [ ] No secrets in environment variables or code
- [ ] Secret rotation policy configured (90 days)
- [ ] Access to secrets audited and logged
- [ ] Emergency secret rotation procedure documented

### Database Security

- [ ] Database encryption at rest enabled (AES-256)
- [ ] Database encryption in transit (TLS 1.3)
- [ ] Database not publicly accessible
- [ ] Database credentials rotated
- [ ] Automated backups enabled (point-in-time recovery)
- [ ] Backup encryption enabled
- [ ] Database audit logging enabled

### Network Security

- [ ] TLS 1.3 enforced on all endpoints
- [ ] TLS 1.2 minimum (legacy clients)
- [ ] SSL certificates valid and auto-renewed
- [ ] WAF rules configured and tested
- [ ] DDoS protection enabled (AWS Shield)
- [ ] VPC properly segmented
- [ ] Private subnets for application tier
- [ ] NAT Gateway for outbound traffic
- [ ] VPC Flow Logs enabled

### Security Groups & IAM

- [ ] Security groups follow least-privilege
- [ ] No 0.0.0.0/0 ingress (except ALB)
- [ ] IAM roles follow least-privilege
- [ ] No IAM users with console access in production
- [ ] MFA enforced for all IAM users
- [ ] Service accounts use IAM roles for pods

---

## Application Security

### Dependencies

- [ ] All dependencies updated to latest secure versions
- [ ] No known vulnerabilities (npm audit, Snyk)
- [ ] Dependency lock files committed
- [ ] Automated vulnerability scanning in CI

### Security Headers

- [ ] Content-Security-Policy configured
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Strict-Transport-Security (HSTS)
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy configured

### CORS Configuration

- [ ] CORS restricted to known origins
- [ ] No wildcard (\*) in production
- [ ] Credentials only with specific origins
- [ ] Preflight caching configured

### Rate Limiting

- [ ] API rate limiting enabled
- [ ] Per-user rate limits configured
- [ ] Per-IP rate limits configured
- [ ] Brute force protection on login
- [ ] Rate limit headers returned

### Input Validation

- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] CSRF tokens on all forms
- [ ] File upload validation (type, size)
- [ ] Path traversal prevention

### Error Handling

- [ ] Error messages sanitized (no stack traces)
- [ ] Generic errors for authentication failures
- [ ] Error logging without sensitive data
- [ ] Custom error pages configured

---

## Authentication & Authorization

### Password Policy

- [ ] Minimum 12 characters required
- [ ] Complexity requirements (upper, lower, number, special)
- [ ] Password history (prevent reuse of last 10)
- [ ] Breached password checking (Have I Been Pwned)
- [ ] Account lockout after 5 failed attempts
- [ ] Lockout duration: 15 minutes

### Multi-Factor Authentication

- [ ] MFA available for all users
- [ ] MFA required for admin accounts
- [ ] TOTP and WebAuthn supported
- [ ] Recovery codes generated and documented
- [ ] MFA bypass procedure documented (with approval)

### Session Management

- [ ] Session timeout configured (30 minutes idle)
- [ ] Absolute session timeout (24 hours)
- [ ] Session invalidation on password change
- [ ] Session invalidation on logout
- [ ] Concurrent session limits (5 per user)
- [ ] Secure session cookies (HttpOnly, Secure, SameSite)

### JWT Configuration

- [ ] JWT expiry appropriate (15 minutes)
- [ ] Refresh token expiry (7 days)
- [ ] Refresh token rotation enabled
- [ ] JWT signed with RS256
- [ ] Token blacklisting for revocation
- [ ] Audience and issuer validated

### OAuth/Social Login

- [ ] OAuth state parameter validated
- [ ] Redirect URIs strictly validated
- [ ] Token exchange server-side only
- [ ] Social login accounts linked securely

---

## Monitoring & Detection

### Security Logging

- [ ] Authentication events logged
- [ ] Authorization failures logged
- [ ] Admin actions logged
- [ ] Data access logged
- [ ] Security events centralized (CloudWatch/SIEM)
- [ ] Log retention configured (90 days min)

### Anomaly Detection

- [ ] Unusual login patterns detected
- [ ] Geographic anomaly detection
- [ ] Time-based anomaly detection
- [ ] Velocity checks on sensitive operations
- [ ] Alerts configured for anomalies

### Intrusion Detection

- [ ] WAF logging enabled
- [ ] Failed request patterns monitored
- [ ] Port scanning detection
- [ ] Known attack pattern detection

### Alerting

- [ ] Security alerts routed to security team
- [ ] Critical alerts trigger PagerDuty
- [ ] Alert fatigue managed (actionable alerts only)
- [ ] Runbooks linked to alerts

---

## Data Protection

### Data Classification

- [ ] PII identified and documented
- [ ] Payment data handling compliant (PCI-DSS)
- [ ] Data inventory maintained
- [ ] Data flow diagrams current

### Encryption

- [ ] PII encrypted at rest
- [ ] Payment data encrypted (field-level)
- [ ] Encryption keys managed in KMS
- [ ] Key rotation automated

### Data Retention

- [ ] Retention policies defined
- [ ] Automated data deletion
- [ ] Audit trail for deletions
- [ ] Right to erasure implemented

### Backup Security

- [ ] Backups encrypted
- [ ] Backup access restricted
- [ ] Backup restoration tested
- [ ] Cross-region backups enabled

---

## Third-Party Security

### Vendor Assessment

- [ ] Critical vendors security-reviewed
- [ ] Vendor SOC 2 reports on file
- [ ] Data processing agreements signed
- [ ] Vendor access audited

### API Security

- [ ] Third-party API keys secured
- [ ] API key rotation scheduled
- [ ] Outbound request validation
- [ ] Webhook signature verification

---

## Compliance

### GDPR

- [ ] Privacy policy published
- [ ] Cookie consent implemented
- [ ] Data export functionality
- [ ] Data deletion functionality
- [ ] DPO contact published

### SOC 2

- [ ] Access controls documented
- [ ] Change management process
- [ ] Incident response plan
- [ ] Business continuity plan

### PCI-DSS (if applicable)

- [ ] Cardholder data environment scoped
- [ ] Quarterly vulnerability scans
- [ ] Annual penetration test
- [ ] SAQ completed

---

## Verification

### Security Testing

- [ ] Penetration test completed (last 12 months)
- [ ] Vulnerability scan completed (last 30 days)
- [ ] Code security review completed
- [ ] Dependency audit completed

### Sign-off

| Area            | Verified By | Date | Notes |
| --------------- | ----------- | ---- | ----- |
| Infrastructure  |             |      |       |
| Application     |             |      |       |
| Authentication  |             |      |       |
| Monitoring      |             |      |       |
| Data Protection |             |      |       |
| Compliance      |             |      |       |

**Security Lead Approval:**

Name: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***
Date: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***
Signature: **\*\*\*\***\_\_\_**\*\*\*\***
