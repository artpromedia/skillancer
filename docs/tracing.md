# Distributed Tracing with OpenTelemetry and AWS X-Ray

This document describes the distributed tracing implementation for Skillancer using OpenTelemetry SDK and AWS X-Ray.

## Overview

The `@skillancer/tracing` package provides:

- **OpenTelemetry SDK Setup**: Auto-instrumentation for Node.js applications
- **AWS X-Ray Integration**: Native X-Ray propagation and trace ID generation
- **Framework Plugins**: Ready-to-use plugins for Fastify and Express
- **Prisma Instrumentation**: Automatic database operation tracing
- **Decorators**: `@Traced` decorator for method-level tracing

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Application                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Fastify   │  │   Express   │  │   Prisma    │  │   Custom    │        │
│  │   Plugin    │  │  Middleware │  │   Tracing   │  │   Spans     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
│                    ┌──────────────▼──────────────┐                          │
│                    │   OpenTelemetry SDK         │                          │
│                    │   - Auto-instrumentation    │                          │
│                    │   - X-Ray Propagator        │                          │
│                    │   - X-Ray ID Generator      │                          │
│                    │   - Batch Span Processor    │                          │
│                    └──────────────┬──────────────┘                          │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │   AWS X-Ray Daemon (Sidecar)  │
                    │   UDP Port 2000               │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │       AWS X-Ray Service       │
                    │   - Trace Storage             │
                    │   - Service Map               │
                    │   - Insights                  │
                    └───────────────────────────────┘
```

## Installation

```bash
# Install the tracing package
pnpm add @skillancer/tracing

# Required peer dependencies
pnpm add fastify  # For Fastify applications
pnpm add express  # For Express applications
pnpm add @prisma/client  # For Prisma instrumentation
```

## Quick Start

### 1. Initialize Tracing (Entry Point)

Initialize tracing **before** importing any other modules:

```typescript
// src/main.ts (or app entry point)
import { initTracing } from '@skillancer/tracing';

// Initialize tracing first!
initTracing({
  serviceName: 'skillancer-api',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV,
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});

// Then import and start your application
import { startServer } from './server';
startServer();
```

### 2. Fastify Plugin

```typescript
import Fastify from 'fastify';
import { tracingPlugin } from '@skillancer/tracing/fastify-plugin';

const app = Fastify();

await app.register(tracingPlugin, {
  serviceName: 'skillancer-api',
  ignoreRoutes: ['/health', '/ready', '/metrics'],
  extractUserFromRequest: (request) => request.user?.id,
  additionalAttributes: (request) => ({
    'tenant.id': request.headers['x-tenant-id'],
  }),
});
```

### 3. Express Middleware

```typescript
import express from 'express';
import {
  createTracingMiddleware,
  createTracingErrorMiddleware,
} from '@skillancer/tracing/express-middleware';

const app = express();

// Add tracing middleware early in the stack
app.use(
  createTracingMiddleware({
    serviceName: 'skillancer-api',
    ignoreRoutes: ['/health', '/ready'],
  })
);

// Your routes here...

// Add error tracing middleware after error handlers
app.use(createTracingErrorMiddleware());
```

### 4. Prisma Instrumentation

```typescript
import { PrismaClient } from '@prisma/client';
import { createPrismaTracingMiddleware } from '@skillancer/tracing/prisma';

const prisma = new PrismaClient();

// Add tracing middleware
prisma.$use(
  createPrismaTracingMiddleware({
    dbName: 'skillancer',
    logQueries: process.env.NODE_ENV !== 'production',
  })
);
```

## Manual Instrumentation

### Creating Custom Spans

```typescript
import { createSpan, SpanKind } from '@skillancer/tracing';

async function processOrder(orderId: string) {
  return createSpan(
    'order.process',
    async (span) => {
      span.setAttribute('order.id', orderId);

      // Your business logic here
      const result = await doSomething();

      span.addEvent('order.validated', { status: 'success' });
      return result;
    },
    {
      kind: SpanKind.INTERNAL,
      attributes: { 'order.id': orderId },
    }
  );
}
```

### Using the @Traced Decorator

```typescript
import { Traced } from '@skillancer/tracing/fastify-plugin';

class UserService {
  @Traced('user.findById')
  async findById(id: string): Promise<User | null> {
    // Method will be automatically traced
    return this.prisma.user.findUnique({ where: { id } });
  }

  @Traced() // Uses class.method as span name
  async updateProfile(userId: string, data: UpdateProfileDto): Promise<User> {
    // Automatically named 'UserService.updateProfile'
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
```

### Adding Context to Current Span

```typescript
import { addSpanAttributes, addSpanEvent, recordException } from '@skillancer/tracing';

function processPayment(paymentData: PaymentData) {
  // Add attributes
  addSpanAttributes({
    'payment.amount': paymentData.amount,
    'payment.currency': paymentData.currency,
    'payment.method': paymentData.method,
  });

  try {
    const result = chargeCard(paymentData);

    // Add success event
    addSpanEvent('payment.charged', {
      transaction_id: result.transactionId,
    });

    return result;
  } catch (error) {
    // Record exception
    recordException(error);
    throw error;
  }
}
```

### Traced Transactions

```typescript
import { tracedTransaction } from '@skillancer/tracing/prisma';

async function createOrder(orderData: CreateOrderDto) {
  return tracedTransaction(prisma, 'create-order', async (tx) => {
    // All operations within this transaction will be traced
    const order = await tx.order.create({ data: orderData });

    await tx.orderItem.createMany({
      data: orderData.items.map((item) => ({
        ...item,
        orderId: order.id,
      })),
    });

    await tx.inventory.updateMany({
      // Update inventory...
    });

    return order;
  });
}
```

## Configuration Options

### TracingConfig

| Option                       | Type                   | Default                   | Description               |
| ---------------------------- | ---------------------- | ------------------------- | ------------------------- |
| `serviceName`                | `string`               | **required**              | Name of your service      |
| `serviceVersion`             | `string`               | `'0.0.0'`                 | Version of your service   |
| `environment`                | `string`               | `NODE_ENV`                | Deployment environment    |
| `otlpEndpoint`               | `string`               | `'http://localhost:4318'` | OTLP collector endpoint   |
| `enabled`                    | `boolean`              | `true`                    | Enable/disable tracing    |
| `sampleRate`                 | `number`               | `1.0`                     | Sampling rate (0.0 - 1.0) |
| `ignoreUrls`                 | `(string \| RegExp)[]` | `[]`                      | URLs to ignore            |
| `additionalInstrumentations` | `unknown[]`            | `[]`                      | Extra instrumentations    |

### Environment Variables

The package respects standard OpenTelemetry environment variables:

| Variable                      | Description                         |
| ----------------------------- | ----------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint             |
| `OTEL_SERVICE_NAME`           | Service name (overridden by config) |
| `OTEL_TRACES_SAMPLER`         | Sampling configuration              |
| `AWS_XRAY_DAEMON_ADDRESS`     | X-Ray daemon address                |

## AWS Infrastructure

### X-Ray Sampling Rules

The Terraform configuration creates intelligent sampling rules:

| Rule         | Priority | Rate | Description            |
| ------------ | -------- | ---- | ---------------------- |
| Payments     | 500      | 100% | All payment operations |
| Errors       | 1000     | 100% | All errors (5xx)       |
| High Latency | 2000     | 100% | Requests > 1s          |
| API          | 3000     | 10%  | API endpoints          |
| Default      | 10000    | 5%   | Everything else        |

### X-Ray Groups

Pre-configured groups for filtering:

- **Errors**: `responsetime > 1 OR error = true OR fault = true`
- **API Service**: `service("skillancer-api-*")`
- **Database**: `service(type(database))`
- **High Latency**: `responsetime > 2`

### ECS X-Ray Sidecar

Enable X-Ray sidecar in your ECS service:

```hcl
module "api_service" {
  source = "../modules/ecs-service"

  service_name = "api"
  # ... other config ...

  # Enable X-Ray sidecar
  enable_xray = true
}
```

## Best Practices

### 1. Initialize Early

Always initialize tracing before importing other modules:

```typescript
// ✅ Good
import { initTracing } from '@skillancer/tracing';
initTracing({ serviceName: 'my-service' });

import { app } from './app';
```

```typescript
// ❌ Bad
import { app } from './app';

import { initTracing } from '@skillancer/tracing';
initTracing({ serviceName: 'my-service' });
```

### 2. Use Meaningful Span Names

```typescript
// ✅ Good - descriptive, hierarchical
createSpan('order.payment.process', fn);
createSpan('user.profile.update', fn);

// ❌ Bad - too generic
createSpan('process', fn);
createSpan('update', fn);
```

### 3. Add Relevant Attributes

```typescript
// ✅ Good - business-relevant attributes
span.setAttributes({
  'order.id': orderId,
  'order.total': total,
  'customer.tier': customerTier,
});

// ❌ Bad - missing context
span.setAttribute('id', orderId);
```

### 4. Record Exceptions Properly

```typescript
try {
  await riskyOperation();
} catch (error) {
  // ✅ Good - record and re-throw
  recordException(error);
  throw error;
}
```

### 5. Graceful Shutdown

```typescript
import { shutdownTracing } from '@skillancer/tracing';

process.on('SIGTERM', async () => {
  await shutdownTracing();
  process.exit(0);
});
```

## Troubleshooting

### Traces Not Appearing in X-Ray

1. **Check X-Ray daemon is running**:

   ```bash
   docker logs xray-daemon
   ```

2. **Verify IAM permissions**: Ensure the ECS task role has `xray:PutTraceSegments` permission

3. **Check sampling rules**: Low sampling rates may cause traces to be dropped

4. **Verify OTLP endpoint**: Ensure `OTEL_EXPORTER_OTLP_ENDPOINT` is correct

### High Memory Usage

Reduce batch size and queue size:

```typescript
initTracing({
  serviceName: 'my-service',
  // Reduce batch processor settings
});
```

### Missing Spans

Ensure all async operations complete before the parent span ends:

```typescript
// ✅ Good - await all operations
await createSpan('parent', async (span) => {
  await Promise.all([operation1(), operation2()]);
});

// ❌ Bad - fire and forget
createSpan('parent', async (span) => {
  operation1(); // Not awaited!
  operation2(); // Not awaited!
});
```

## API Reference

### Core Functions

| Function                        | Description                         |
| ------------------------------- | ----------------------------------- |
| `initTracing(config)`           | Initialize OpenTelemetry with X-Ray |
| `shutdownTracing()`             | Gracefully shutdown tracing         |
| `isTracingActive()`             | Check if tracing is initialized     |
| `getTracer(name)`               | Get a tracer instance               |
| `getCurrentSpan()`              | Get the current active span         |
| `createSpan(name, fn, options)` | Create and execute a span           |
| `addSpanAttributes(attrs)`      | Add attributes to current span      |
| `addSpanEvent(name, attrs)`     | Add event to current span           |
| `recordException(error)`        | Record exception on current span    |
| `extractTraceContext()`         | Extract context for propagation     |

### Fastify Plugin

| Export                      | Description                        |
| --------------------------- | ---------------------------------- |
| `tracingPlugin`             | Fastify plugin for request tracing |
| `createSpan(req, name, fn)` | Create span in request context     |
| `Traced(name?, attrs?)`     | Method decorator                   |

### Express Middleware

| Export                              | Description                    |
| ----------------------------------- | ------------------------------ |
| `createTracingMiddleware(opts)`     | Request tracing middleware     |
| `createTracingErrorMiddleware()`    | Error handling middleware      |
| `createSpan(req, name, fn)`         | Create span in request context |
| `getTraceId(req)`                   | Get trace ID from request      |
| `addRequestAttributes(req, attrs)`  | Add attributes to request span |
| `addRequestEvent(req, name, attrs)` | Add event to request span      |

### Prisma

| Export                                | Description                      |
| ------------------------------------- | -------------------------------- |
| `createPrismaTracingMiddleware(opts)` | Prisma middleware for DB tracing |
| `tracedTransaction(prisma, name, fn)` | Traced Prisma transaction        |
| `TracedQuery(name?, attrs?)`          | Query method decorator           |
