# Audit Logging System

Skillancer's unified audit logging system provides comprehensive compliance-ready audit trails for all security-relevant events across all products.

## Features

- **Event Categorization**: Authentication, Authorization, Data Access, Payment, Contract, SkillPod, Security, Compliance
- **Compliance Mappings**: SOC2, GDPR, PCI, HIPAA compliance tags with automatic retention policies
- **Integrity Chain**: SHA-256 hash chain for tamper detection
- **Sensitive Data Redaction**: Automatic PII/credential masking
- **Anomaly Detection**: Baseline-based activity monitoring
- **Export & Archival**: S3-based exports with Glacier archival
- **GDPR Support**: Data export and deletion capabilities

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Services      │     │   BullMQ        │     │   Audit-SVC     │
│   (clients)     │────▶│   Queues        │────▶│   (consumer)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   MongoDB       │
                                                │   (audit_logs)  │
                                                └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   S3/Glacier    │
                                                │   (archives)    │
                                                └─────────────────┘
```

## Quick Start

### 1. Install the audit client in your service

```bash
pnpm add @skillancer/audit-client
```

### 2. Initialize the client

```typescript
import { AuditClient, AuditEventTypes, ActorType, OutcomeStatus } from '@skillancer/audit-client';

const auditClient = new AuditClient({
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  serviceId: 'my-service',
  defaultActorType: ActorType.USER,
});
```

### 3. Log events

```typescript
// Log a successful login
await auditClient.logAuthentication({
  actor: {
    id: user.id,
    type: ActorType.USER,
    email: user.email,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
    sessionId: session.id,
  },
  action: 'login',
  outcome: { status: OutcomeStatus.SUCCESS, duration: 150 },
  request: {
    method: 'POST',
    path: '/auth/login',
    correlationId: request.id,
  },
});

// Log a failed login (uses sync queue for higher priority)
await auditClient.logSync({
  eventType: AuditEventTypes.LOGIN_FAILED,
  actor: {
    id: 'anonymous',
    type: ActorType.ANONYMOUS,
    ipAddress: request.ip,
  },
  resource: { type: 'auth', id: 'login-attempt' },
  action: 'login_failed',
  outcome: {
    status: OutcomeStatus.FAILURE,
    errorCode: 'INVALID_CREDENTIALS',
    errorMessage: 'Invalid email or password',
  },
});

// Log a payment
await auditClient.logPayment({
  actor: { id: user.id, type: ActorType.USER },
  resource: { type: 'payment', id: payment.id },
  action: 'completed',
  outcome: { status: OutcomeStatus.SUCCESS },
  metadata: {
    amount: payment.amount,
    currency: payment.currency,
    contractId: payment.contractId,
  },
});

// Log a security event (high priority)
await auditClient.logSecurityEventSync({
  actor: { id: user.id, type: ActorType.USER, ipAddress: request.ip },
  action: 'suspicious_login',
  outcome: { status: OutcomeStatus.SUCCESS },
  metadata: {
    reason: 'Login from new location',
    location: 'Unknown',
  },
});

// Log a GDPR compliance event
await auditClient.logComplianceEvent({
  actor: { id: user.id, type: ActorType.USER },
  action: 'gdpr_data_request',
  resource: { type: 'user', id: user.id },
  outcome: { status: OutcomeStatus.SUCCESS },
  metadata: { requestType: 'data_export' },
});

// Log an admin action
await auditClient.logAdminAction({
  actor: { id: admin.id, type: ActorType.ADMIN },
  action: 'user_suspended',
  resource: { type: 'user', id: targetUser.id },
  outcome: { status: OutcomeStatus.SUCCESS },
  changes: {
    before: { status: 'active' },
    after: { status: 'suspended' },
  },
  metadata: { reason: 'Terms of service violation' },
});
```

### 4. Using the Fastify plugin (automatic request logging)

```typescript
import { auditPlugin } from '@skillancer/audit-client/fastify';

fastify.register(auditPlugin, {
  redisUrl: process.env.REDIS_URL,
  serviceId: 'my-service',
  autoLog: true, // Automatically log all requests
  excludePaths: ['/health', '/ready', '/metrics'],
  getActor: (request) => ({
    id: request.user?.id ?? 'anonymous',
    type: request.user ? ActorType.USER : ActorType.ANONYMOUS,
    email: request.user?.email,
    ipAddress: request.ip,
  }),
});

// Access client in routes
fastify.post('/users', async (request, reply) => {
  const user = await createUser(request.body);

  // Log with custom event type
  await fastify.audit.log({
    eventType: AuditEventTypes.USER_CREATED,
    actor: request.auditActor!,
    resource: { type: 'user', id: user.id },
    action: 'create',
    outcome: { status: OutcomeStatus.SUCCESS },
  });

  return reply.send(user);
});
```

## Event Types

### Authentication Events

| Event                   | Description           |
| ----------------------- | --------------------- |
| `AUTH_LOGIN_SUCCESS`    | Successful user login |
| `AUTH_LOGIN_FAILED`     | Failed login attempt  |
| `AUTH_LOGOUT`           | User logout           |
| `AUTH_PASSWORD_CHANGED` | Password change       |
| `AUTH_MFA_ENABLED`      | MFA enabled           |
| `AUTH_MFA_DISABLED`     | MFA disabled          |
| `AUTH_ACCOUNT_LOCKED`   | Account locked        |

### Security Events (High Priority)

| Event                       | Description            | Immediate Alert |
| --------------------------- | ---------------------- | --------------- |
| `SECURITY_SUSPICIOUS_LOGIN` | Unusual login activity | ✅              |
| `SECURITY_BRUTE_FORCE`      | Brute force detected   | ✅              |
| `SECURITY_FRAUD_DETECTED`   | Fraud detection        | ✅              |
| `SECURITY_DATA_BREACH`      | Data breach detected   | ✅              |

### Compliance Events (Permanent Retention)

| Event                          | Description              |
| ------------------------------ | ------------------------ |
| `COMPLIANCE_GDPR_DATA_REQUEST` | GDPR data access request |
| `COMPLIANCE_GDPR_DATA_DELETED` | GDPR data deletion       |
| `COMPLIANCE_CONSENT_GRANTED`   | User consent granted     |
| `COMPLIANCE_CONSENT_REVOKED`   | User consent revoked     |

### Payment Events

| Event                     | Description       |
| ------------------------- | ----------------- |
| `PAYMENT_COMPLETED`       | Payment processed |
| `PAYMENT_FAILED`          | Payment failed    |
| `PAYMENT_REFUNDED`        | Payment refunded  |
| `PAYMENT_ESCROW_FUNDED`   | Escrow funded     |
| `PAYMENT_ESCROW_RELEASED` | Escrow released   |

## Retention Policies

| Policy      | Duration | Use Case                       |
| ----------- | -------- | ------------------------------ |
| `SHORT`     | 90 days  | Operational logs, debugging    |
| `STANDARD`  | 365 days | Standard audit trails          |
| `EXTENDED`  | 7 years  | Financial records, contracts   |
| `PERMANENT` | Forever  | Compliance, security incidents |

## API Endpoints

### Query Audit Logs

```
GET /api/v1/audit/logs
Query params: page, pageSize, startDate, endDate, eventType, actorId, resourceType
```

### Get User Timeline

```
GET /api/v1/audit/users/:userId/timeline
Query params: startDate, endDate, limit
```

### Get Resource Audit Trail

```
GET /api/v1/audit/resources/:resourceType/:resourceId/trail
Query params: startDate, endDate, limit
```

### Compliance Reports

```
GET /api/v1/audit/compliance/:tag/report
Query params: startDate, endDate
```

### Export Audit Logs

```
POST /api/v1/export
Body: { filters, format: 'JSON' | 'CSV', includeFields }
```

## Environment Variables

| Variable          | Default                     | Description                    |
| ----------------- | --------------------------- | ------------------------------ |
| `MONGO_URI`       | `mongodb://localhost:27017` | MongoDB connection string      |
| `MONGO_DB_NAME`   | `skillancer_audit`          | MongoDB database name          |
| `REDIS_URL`       | `redis://localhost:6379`    | Redis connection string        |
| `AUDIT_S3_BUCKET` | `skillancer-audit-logs`     | S3 bucket for exports/archives |
| `AWS_REGION`      | `us-east-1`                 | AWS region for S3              |
| `PORT`            | `3010`                      | Audit service port             |

## Testing

```bash
# Run audit-svc tests
cd services/audit-svc
pnpm test

# Run with coverage
pnpm test:coverage
```
