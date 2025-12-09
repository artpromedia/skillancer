# Error Tracking with Sentry

This document covers the setup and usage of Sentry for error tracking in Skillancer.

## Overview

Skillancer uses [Sentry](https://sentry.io) for:

- Error tracking and aggregation
- Performance monitoring
- Release tracking
- User context tracking
- Breadcrumb trails for debugging

## Packages

### @skillancer/error-tracking

The main error tracking package providing Sentry integration.

```bash
pnpm add @skillancer/error-tracking
```

## Setup

### Basic Initialization

```typescript
import { initSentry } from '@skillancer/error-tracking';

initSentry({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.APP_VERSION,
  tracesSampleRate: 0.1, // 10% of transactions
  profilesSampleRate: 0.1, // 10% of sampled transactions
});
```

### Configuration Options

| Option               | Type    | Description                                         |
| -------------------- | ------- | --------------------------------------------------- |
| `dsn`                | string  | Sentry DSN (required)                               |
| `environment`        | string  | Environment name (production, staging, etc.)        |
| `release`            | string  | Application version/release                         |
| `tracesSampleRate`   | number  | Percentage of transactions to sample (0-1)          |
| `profilesSampleRate` | number  | Percentage of sampled transactions to profile (0-1) |
| `debug`              | boolean | Enable debug mode                                   |
| `enabled`            | boolean | Enable/disable Sentry                               |

## Fastify Integration

Use the Sentry plugin for automatic request/error tracking in Fastify apps:

```typescript
import Fastify from 'fastify';
import { sentryPlugin } from '@skillancer/error-tracking/fastify-plugin';

const app = Fastify();

app.register(sentryPlugin, {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  tracesSampleRate: 0.1,
});

// Routes automatically have Sentry context
app.get('/api/users', async (request, reply) => {
  // Request info automatically attached to errors
  throw new Error('Something went wrong');
});

await app.listen({ port: 3000 });
```

### Plugin Features

- **Request Context**: Automatic attachment of request info (URL, method, headers)
- **User Context**: Automatic user identification from `request.user`
- **Error Capture**: Automatic error capturing with request context
- **Transaction Tracking**: Automatic transaction/span creation for performance monitoring

## Express Integration

Use the middleware for Express apps:

```typescript
import express from 'express';
import {
  createSentryRequestHandler,
  createSentryErrorHandler,
} from '@skillancer/error-tracking/express-middleware';

const app = express();

// Initialize Sentry middleware (must be first)
app.use(
  createSentryRequestHandler({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.APP_VERSION,
    tracesSampleRate: 0.1,
  })
);

// Your routes
app.get('/api/users', (req, res) => {
  throw new Error('Something went wrong');
});

// Error handler (must be last)
app.use(createSentryErrorHandler());

app.listen(3000);
```

## Manual Error Capture

### Capture Errors

```typescript
import { captureError, captureMessage } from '@skillancer/error-tracking';

try {
  await riskyOperation();
} catch (error) {
  captureError(error, {
    level: 'error',
    tags: { module: 'payment' },
    extra: { userId: '123', orderId: '456' },
  });
}

// Capture messages
captureMessage('Important event occurred', 'info', {
  tags: { feature: 'onboarding' },
});
```

### Set User Context

```typescript
import { setUser } from '@skillancer/error-tracking';

// Set user after authentication
setUser({
  id: user.id,
  email: user.email,
  username: user.name,
});
```

### Add Tags and Breadcrumbs

```typescript
import { setTag, addBreadcrumb } from '@skillancer/error-tracking';

// Set tags for filtering
setTag('tenant', 'acme-corp');
setTag('feature', 'dashboard');

// Add breadcrumbs for context
addBreadcrumb({
  category: 'user-action',
  message: 'User clicked submit',
  level: 'info',
  data: { formId: 'contact-form' },
});
```

## Graceful Shutdown

Ensure all events are sent before shutdown:

```typescript
import { flushSentry, closeSentry } from '@skillancer/error-tracking';

process.on('SIGTERM', async () => {
  // Wait for events to be sent (2 second timeout)
  await flushSentry(2000);

  // Or close completely
  await closeSentry();

  process.exit(0);
});
```

## Best Practices

### 1. Sample Rates

```typescript
// Development
initSentry({
  tracesSampleRate: 1.0, // 100% for debugging
  profilesSampleRate: 1.0,
});

// Production
initSentry({
  tracesSampleRate: 0.1, // 10% to reduce noise/cost
  profilesSampleRate: 0.1,
});
```

### 2. Error Filtering

```typescript
initSentry({
  beforeSend(event, hint) {
    // Filter out expected errors
    const error = hint.originalException;
    if (error?.message?.includes('Expected error')) {
      return null;
    }
    return event;
  },
});
```

### 3. Sensitive Data Scrubbing

```typescript
initSentry({
  beforeSend(event) {
    // Remove sensitive data
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    return event;
  },
});
```

### 4. Release Tracking

Set the release version to track deployments:

```typescript
initSentry({
  release: `skillancer-api@${process.env.GIT_SHA || '1.0.0'}`,
});
```

## Environment Variables

| Variable                      | Description             |
| ----------------------------- | ----------------------- |
| `SENTRY_DSN`                  | Sentry project DSN      |
| `SENTRY_ENVIRONMENT`          | Environment name        |
| `SENTRY_RELEASE`              | Application version     |
| `SENTRY_TRACES_SAMPLE_RATE`   | Transaction sample rate |
| `SENTRY_PROFILES_SAMPLE_RATE` | Profile sample rate     |

## Integration with Tracing

Sentry integrates with OpenTelemetry tracing:

```typescript
import { initTracing } from '@skillancer/tracing';
import { initSentry } from '@skillancer/error-tracking';

// Initialize tracing first
initTracing({
  serviceName: 'api-service',
  environment: 'production',
});

// Then Sentry (will automatically use trace context)
initSentry({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    // OpenTelemetry integration auto-configured
  ],
});
```

## Troubleshooting

### Events Not Appearing

1. Check DSN is correct
2. Verify `enabled` is not `false`
3. Check sample rates aren't `0`
4. Ensure `flushSentry()` is called before exit

### High Event Volume

1. Reduce `tracesSampleRate`
2. Add `beforeSend` filtering
3. Use `ignoreErrors` option

### Missing Context

1. Ensure middleware is registered first
2. Check user context is set after auth
3. Add breadcrumbs for important actions

## Related Documentation

- [Alerting Runbook](./alerting-runbook.md) - PagerDuty integration and incident response
- [Tracing](./tracing.md) - Distributed tracing with OpenTelemetry
- [Metrics](./metrics.md) - Application metrics and monitoring
