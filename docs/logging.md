# Centralized Logging

This document describes the centralized logging infrastructure for Skillancer, including the TypeScript logger package and CloudWatch Logs infrastructure.

## Overview

Skillancer uses a structured logging approach with:

- **Pino** for fast, structured JSON logging in Node.js services
- **CloudWatch Logs** for centralized log aggregation
- **CloudWatch Logs Insights** for log analysis and querying
- **S3** for long-term log archival (optional)

## Logger Package (`@skillancer/logger`)

### Installation

The logger package is included in the monorepo. Add it to your service:

```json
{
  "dependencies": {
    "@skillancer/logger": "workspace:*"
  }
}
```

### Basic Usage

```typescript
import { createLogger } from '@skillancer/logger';

const logger = createLogger({
  name: 'my-service',
  level: process.env.LOG_LEVEL || 'info',
});

// Simple logging
logger.info('Service started');
logger.warn({ userId: '123' }, 'User session expired');
logger.error({ err: error }, 'Request failed');
```

### Request Context Propagation

The logger supports AsyncLocalStorage for automatic request context:

```typescript
import { runWithContext, getContext } from '@skillancer/logger/context';

// Set context at the start of a request
runWithContext({ requestId: 'req_123', userId: 'user_456' }, async () => {
  // All logs within this context will include requestId and userId
  logger.info('Processing request');

  // Get current context
  const ctx = getContext();
  console.log(ctx?.requestId); // 'req_123'
});
```

### Fastify Integration

```typescript
import Fastify from 'fastify';
import { fastifyLogger } from '@skillancer/logger/fastify';

const app = Fastify();

app.register(fastifyLogger, {
  name: 'api-gateway',
  level: 'info',
  // Extract user from JWT
  userIdExtractor: (req) => req.user?.id,
  // Ignore health checks
  ignorePaths: ['/health', '/ready', '/metrics'],
});

app.get('/users/:id', async (request, reply) => {
  // Access logger from request
  request.log.info({ userId: request.params.id }, 'Fetching user');
  return { id: request.params.id };
});
```

### Express Integration

```typescript
import express from 'express';
import { createExpressLogger, createExpressErrorLogger } from '@skillancer/logger/express';

const app = express();

// Add request logging middleware
app.use(
  createExpressLogger({
    name: 'api-server',
    level: 'info',
    userIdExtractor: (req) => req.user?.id,
    tenantIdExtractor: (req) => req.headers['x-tenant-id'],
  })
);

// Your routes
app.get('/api/data', (req, res) => {
  req.log.info('Fetching data');
  res.json({ data: [] });
});

// Add error logging middleware (after routes)
app.use(createExpressErrorLogger());
```

## Log Format

All logs are structured JSON with consistent fields:

```json
{
  "level": 30,
  "time": 1699123456789,
  "pid": 12345,
  "hostname": "service-1",
  "name": "api-gateway",
  "requestId": "req_abc123",
  "userId": "user_456",
  "msg": "Request completed",
  "method": "GET",
  "path": "/api/users",
  "statusCode": 200,
  "responseTime": 45.23
}
```

### Log Levels

| Level | Value | Description             |
| ----- | ----- | ----------------------- |
| trace | 10    | Very detailed debugging |
| debug | 20    | Debugging information   |
| info  | 30    | Normal operation        |
| warn  | 40    | Warning conditions      |
| error | 50    | Error conditions        |
| fatal | 60    | System is unusable      |

### Sensitive Data Redaction

The logger automatically redacts sensitive fields:

- Passwords, secrets, tokens
- Credit card numbers
- API keys
- Authorization headers
- SSN, personal identifiers

```typescript
// This will redact the password field
logger.info({ user: { email: 'user@example.com', password: 'secret123' } }, 'User data');
// Output: { user: { email: 'user@example.com', password: '[REDACTED]' } }
```

## CloudWatch Infrastructure

### Log Groups

The monitoring module creates the following log groups:

| Log Group                         | Purpose              | Retention |
| --------------------------------- | -------------------- | --------- |
| `/skillancer/{env}/application`   | Application logs     | 30 days   |
| `/skillancer/{env}/audit`         | Audit trail          | 365 days  |
| `/skillancer/{env}/security`      | Security events      | 365 days  |
| `/ecs/skillancer-{env}/{service}` | Per-service ECS logs | 30 days   |

### Metric Filters

Automatic metric filters create CloudWatch metrics for:

- **ErrorCount**: Count of error-level logs
- **WarnCount**: Count of warning-level logs
- **FatalErrorCount**: Count of fatal errors
- **HTTP4xxCount**: Client error responses
- **HTTP5xxCount**: Server error responses
- **ResponseTime**: Request response times
- **SlowRequestCount**: Requests over 1 second
- **AuthFailureCount**: Failed authentication attempts
- **SuspiciousActivityCount**: Security alerts

### CloudWatch Alarms

Alarms are configured for critical conditions:

| Alarm              | Threshold                | Action             |
| ------------------ | ------------------------ | ------------------ |
| Error Rate High    | 50 errors / 5 min        | Alert SNS topic    |
| Fatal Errors       | Any fatal error          | Critical SNS topic |
| HTTP 5xx High      | 10 errors / 5 min        | Critical SNS topic |
| Slow Requests High | 20 slow requests / 5 min | Alert SNS topic    |
| Auth Failures High | 50 failures / 5 min      | Critical SNS topic |

### Logs Insights Queries

Pre-defined queries are available in CloudWatch Logs Insights:

1. **Error Summary**: View recent errors with stack traces
2. **Slow Requests**: Find requests taking over 1 second
3. **Requests by Endpoint**: Request counts and latency by path
4. **Error Rate by Endpoint**: Errors grouped by path
5. **User Activity**: Audit log of user actions
6. **Security Events**: Security-related events
7. **Request Trace**: Follow a single request by ID
8. **Response Time Percentiles**: p50, p90, p99 latency over time

## Usage Examples

### Searching Logs by Request ID

```
fields @timestamp, @message, level
| filter requestId = "req_abc123"
| sort @timestamp asc
```

### Finding Errors for a User

```
fields @timestamp, error.message, path, method
| filter userId = "user_456" and level = "error"
| sort @timestamp desc
| limit 100
```

### Response Time Analysis

```
fields @timestamp, responseTime, path
| stats avg(responseTime), pct(responseTime, 99) by bin(1h)
| sort @timestamp
```

## Log Archive (Optional)

Enable log archiving to S3 for long-term retention:

```hcl
module "monitoring" {
  source = "./modules/monitoring"

  enable_log_archive     = true
  log_archive_kms_key_id = aws_kms_key.logs.id  # Optional
}
```

Archive lifecycle:

- **0-90 days**: Standard storage
- **90-365 days**: Glacier
- **365+ days**: Deep Archive
- **7 years**: Deleted (compliance)

## Best Practices

### 1. Use Structured Logging

```typescript
// Good: Structured data
logger.info({ userId, orderId, amount }, 'Order placed');

// Avoid: String interpolation
logger.info(`Order ${orderId} placed by user ${userId} for ${amount}`);
```

### 2. Include Context

```typescript
// Include relevant IDs for correlation
logger.info(
  {
    requestId: ctx.requestId,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    orderId,
  },
  'Processing order'
);
```

### 3. Log at Appropriate Levels

```typescript
// Debug: Detailed debugging info
logger.debug({ query, params }, 'Executing database query');

// Info: Normal operations
logger.info({ duration }, 'Request completed');

// Warn: Recoverable issues
logger.warn({ retryCount }, 'Retrying failed operation');

// Error: Failures requiring attention
logger.error({ err, userId }, 'Failed to process payment');

// Fatal: System cannot continue
logger.fatal({ err }, 'Database connection lost');
```

### 4. Handle Errors Properly

```typescript
try {
  await processOrder(orderId);
} catch (error) {
  // Use 'err' key for proper serialization
  logger.error({ err: error, orderId }, 'Order processing failed');
  throw error;
}
```

### 5. Avoid Logging Sensitive Data

```typescript
// The logger redacts common sensitive fields automatically
// For custom sensitive data, redact manually:
logger.info(
  {
    user: {
      id: user.id,
      email: user.email,
      // Don't log: password, ssn, credit card, etc.
    },
  },
  'User authenticated'
);
```

## Environment Variables

Configure logging via environment variables:

| Variable               | Description                       | Default |
| ---------------------- | --------------------------------- | ------- |
| `LOG_LEVEL`            | Minimum log level                 | `info`  |
| `LOG_PRETTY`           | Enable pretty printing (dev only) | `false` |
| `SERVICE_NAME`         | Service identifier in logs        | -       |
| `AWS_REGION`           | CloudWatch region                 | -       |
| `CLOUDWATCH_LOG_GROUP` | Target log group                  | -       |

## Monitoring Dashboard

The CloudWatch dashboard includes widgets for:

- Log error rates over time
- Response time percentiles
- HTTP status code distribution
- Top endpoints by error rate
- Authentication failure trends

Access via AWS Console → CloudWatch → Dashboards → `skillancer-{environment}`
