# Security Policy

## Reporting Security Vulnerabilities

The Skillancer team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@skillancer.com**

Include the following information in your report:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Full path of the affected source file(s)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if available)
- Impact assessment of the vulnerability
- Any potential mitigations you've identified

### Response Timeline

| Action | Timeline |
|--------|----------|
| Initial acknowledgment | 24 hours |
| Preliminary assessment | 72 hours |
| Status update | 7 days |
| Resolution target | 30-90 days (based on severity) |

### Severity Classification

| Severity | Description | Examples |
|----------|-------------|----------|
| Critical | Immediate exploitation possible | RCE, authentication bypass, data breach |
| High | Significant impact with some complexity | SQL injection, privilege escalation |
| Medium | Limited impact or requires user interaction | Stored XSS, CSRF |
| Low | Minimal impact | Information disclosure, minor issues |

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, data destruction, or service disruption
- Provide us reasonable time to respond before public disclosure
- Do not access or modify data belonging to others
- Do not exploit vulnerabilities beyond what is necessary to demonstrate the issue

## Security Measures

### Authentication & Authorization

- JWT-based authentication with secure token handling
- Role-based access control (RBAC) for all endpoints
- Session management with secure cookie settings
- Multi-factor authentication support

### Data Protection

- All data encrypted at rest (AES-256)
- TLS 1.3 for data in transit
- PII handling compliant with GDPR and CCPA
- Regular data access auditing

### Infrastructure Security

- WAF (Web Application Firewall) protection
- DDoS mitigation via AWS Shield
- Network segmentation and private subnets
- Regular security patching

### Application Security

- Input validation on all endpoints (Zod schemas)
- Output encoding to prevent XSS
- Parameterized queries to prevent SQL injection
- CORS properly configured
- Security headers via Helmet.js
- Rate limiting to prevent abuse

### Monitoring & Detection

- Centralized logging with anomaly detection
- Real-time security alerting
- Intrusion detection systems
- Regular vulnerability scanning

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | Yes       |
| < 1.0   | No        |

## Security Updates

Security updates are released as patch versions and announced via:

- GitHub Security Advisories
- Email to registered security contacts
- Status page notifications

## Compliance

Skillancer maintains compliance with:

- **GDPR** - General Data Protection Regulation
- **SOC 2 Type II** - Service Organization Control
- **PCI DSS** - Payment Card Industry Data Security Standard (for payment handling)
- **CCPA** - California Consumer Privacy Act

## Bug Bounty Program

We currently operate a private bug bounty program. Researchers who report valid vulnerabilities may be eligible for rewards based on severity:

| Severity | Reward Range |
|----------|-------------|
| Critical | $1,000 - $5,000 |
| High | $500 - $1,000 |
| Medium | $100 - $500 |
| Low | Recognition |

To participate, please contact security@skillancer.com.

## Contact

- Security Team: security@skillancer.com
- PGP Key: Available upon request
- Response: 24-48 hours for initial acknowledgment

---

Last updated: January 2026
