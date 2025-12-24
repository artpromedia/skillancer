# @skillancer/security

Comprehensive Security and Compliance Framework for the Skillancer platform.

## Features

### 🔍 Audit Logging

- Comprehensive security event logging with 60+ event types
- Buffered writes for performance optimization
- SIEM integration ready (Splunk, ELK, etc.)
- Query and search capabilities
- High-risk event alerting

### 🔐 Data Protection

- AES-256-GCM encryption for sensitive data
- Multiple anonymization methods (hash, mask, generalize, suppress, noise)
- Field-level encryption for database records
- Secure hashing with salts

### 📋 Consent Management

- GDPR-compliant consent recording
- Granular consent types (marketing, analytics, third-party, profiling, etc.)
- Consent withdrawal tracking
- Audit trail for all consent changes

### 📝 Data Subject Requests (DSR)

- Support for all GDPR rights (access, deletion, portability, rectification, restriction, objection)
- Automated data gathering across services
- Secure data export
- Anonymization-based deletion

### ⏰ Data Retention

- Configurable retention policies per data type
- Automated policy execution
- Support for delete, anonymize, and archive actions
- Compliance reporting

### 🛡️ Threat Detection

- Login risk analysis with multi-factor assessment
- Brute force detection with automatic IP blocking
- IP reputation checking
- Impossible travel detection
- Device fingerprinting
- XSS and SQL injection detection
- Rate limiting per endpoint

### 📊 Compliance Reporting

- GDPR compliance status dashboard
- PDF report generation
- SOC2, security, and access audit reports
- DSR processing reports
- Compliance check automation

## Installation

```bash
pnpm add @skillancer/security
```

## Quick Start

```typescript
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import {
  createSecurityServices,
  createSecurityRouter,
  createSecurityMiddleware,
} from '@skillancer/security';

// Initialize dependencies
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);
const logger = console; // Use your logger

// Create security services
const services = createSecurityServices({
  prisma,
  redis,
  logger,
  encryptionKey: process.env.ENCRYPTION_KEY,
  geoipEnabled: true,
});

// Create Express router
const securityRouter = createSecurityRouter(services);

// Create middleware
const { securityMiddleware } = createSecurityMiddleware(
  services.threatDetectionService,
  services.auditService,
  logger
);

// Use in Express app
app.use(securityMiddleware);
app.use('/api/security', securityRouter);
```

## API Reference

### Audit Service

```typescript
// Log authentication event
await auditService.logAuthentication(
  'login_success',
  { type: 'user', id: userId, ipAddress, userAgent },
  'success',
  { mfaUsed: true }
);

// Log data access
await auditService.logDataAccess(
  'user_profile_viewed',
  actor,
  { type: 'user', id: targetUserId },
  { fields: ['email', 'phone'] }
);

// Query events
const { events, total } = await auditService.queryEvents({
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  eventType: 'login_failure',
  severity: 'high',
  limit: 100,
});
```

### Data Protection Service

```typescript
// Encrypt sensitive data
const encrypted = dataProtectionService.encrypt('sensitive data');
const decrypted = dataProtectionService.decrypt(encrypted);

// Record consent
await dataProtectionService.recordConsent(userId, 'marketing_emails', true, ipAddress, {
  source: 'signup_form',
});

// Create DSR
const dsr = await dataProtectionService.createDataSubjectRequest(userId, 'access', {
  reason: 'User requested data export',
});

// Process DSR
const result = await dataProtectionService.processAccessRequest(dsr.id, userId);
```

### Threat Detection Service

```typescript
// Analyze login attempt
const analysis = await threatDetectionService.analyzeLogin({
  userId,
  ip: clientIP,
  userAgent,
  timestamp: new Date(),
  loginMethod: 'password',
});

if (analysis.blocked) {
  return res.status(403).json({ error: 'Login blocked', reasons: analysis.reasons });
}

if (analysis.requireMFA) {
  // Trigger MFA flow
}

// Analyze request for threats
const requestAnalysis = await threatDetectionService.analyzeRequest({
  ip: clientIP,
  userAgent,
  method: 'POST',
  path: '/api/users',
  body: req.body,
  headers: req.headers,
  userId,
});

if (requestAnalysis.blocked) {
  return res.status(403).json({ error: requestAnalysis.blockReason });
}

// Block malicious IP
await threatDetectionService.blockIP(ip, 'Brute force attack', 3600);
```

### Compliance Reporting Service

```typescript
// Get GDPR compliance status
const gdprStatus = await complianceReportingService.getGDPRComplianceStatus();

// Generate compliance report
const report = await complianceReportingService.generateComplianceReport(
  'gdpr_audit',
  new Date('2024-01-01'),
  new Date(),
  adminUserId
);

// Run compliance check
const check = await complianceReportingService.runComplianceCheck('GDPR');
console.log(`Compliance score: ${check.score}%`);
```

## API Endpoints

### Audit

- `GET /api/security/audit/events` - Query audit events
- `GET /api/security/audit/events/:id` - Get specific event
- `GET /api/security/audit/actor/:id` - Get actor activity
- `GET /api/security/audit/alerts` - Get security alerts
- `GET /api/security/audit/stats` - Get event statistics

### Data Protection

- `POST /api/security/data-protection/encrypt` - Encrypt data
- `POST /api/security/data-protection/decrypt` - Decrypt data
- `POST /api/security/data-protection/classify` - Classify data

### Consent

- `POST /api/security/consent` - Record consent
- `GET /api/security/consent/:userId` - Get user consents
- `DELETE /api/security/consent/:userId` - Withdraw all consents

### Data Subject Requests

- `POST /api/security/dsr` - Create DSR
- `GET /api/security/dsr` - List DSRs
- `POST /api/security/dsr/:id/process` - Process DSR

### Retention Policies

- `GET /api/security/retention-policies` - List policies
- `POST /api/security/retention-policies` - Create policy
- `POST /api/security/retention-policies/:id/run` - Execute policy

### Threat Detection

- `GET /api/security/threats/blocked-ips` - List blocked IPs
- `POST /api/security/threats/block-ip` - Block IP
- `DELETE /api/security/threats/block-ip/:ip` - Unblock IP
- `GET /api/security/threats/devices/:userId` - Get known devices
- `DELETE /api/security/threats/devices/:userId/:fingerprint` - Remove device

### Compliance

- `GET /api/security/compliance/gdpr/status` - GDPR status
- `POST /api/security/compliance/check/:regulation` - Run compliance check
- `POST /api/security/compliance/reports` - Generate report
- `GET /api/security/compliance/reports` - List reports
- `GET /api/security/compliance/reports/:id` - Get report

## Configuration

### Environment Variables

```env
# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Redis (required for threat detection and caching)
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/skillancer

# Optional: SIEM Integration
SIEM_ENDPOINT=https://your-siem.example.com/api/events
SIEM_API_KEY=your-siem-api-key

# Optional: GeoIP
GEOIP_ENABLED=true
```

### Database Schema

The security package requires these database tables:

- `security_events` - Audit event storage
- `consent_records` - Consent management
- `data_subject_requests` - DSR tracking
- `retention_policies` - Retention policy definitions
- `blocked_ips` - IP blocklist
- `known_devices` - Device fingerprints
- `compliance_reports` - Generated reports

## Security Considerations

1. **Encryption Key Management**: Store encryption keys securely (e.g., HashiCorp Vault, AWS KMS)
2. **Redis Security**: Use TLS-enabled Redis connections
3. **Log Retention**: Implement log rotation and secure storage
4. **Access Control**: Restrict security API access to authorized admins only
5. **Rate Limiting**: Configure appropriate rate limits for your traffic patterns

## License

MIT
