# Metrics and Observability Guide

This document describes the metrics collection system for the Skillancer platform, including custom application metrics, business metrics, dashboards, and SLOs.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [MetricsService API](#metricsservice-api)
- [Framework Integrations](#framework-integrations)
- [Business Metrics](#business-metrics)
- [CloudWatch Dashboards](#cloudwatch-dashboards)
- [Alarms and Alerting](#alarms-and-alerting)
- [SLOs and Error Budgets](#slos-and-error-budgets)
- [Best Practices](#best-practices)

---

## Overview

The `@skillancer/metrics` package provides a centralized metrics collection system that:

- **Collects application metrics**: Request counts, latencies, error rates
- **Tracks business metrics**: User signups, jobs posted, payments processed
- **Integrates with CloudWatch**: Automatic publishing with batching and retry
- **Supports SLI/SLO tracking**: Availability and latency targets
- **Provides framework plugins**: Easy integration with Fastify and Express

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Application Layer                             │
├──────────────────┬──────────────────┬──────────────────┬────────────┤
│  Fastify Plugin  │ Express Middleware│ Business Metrics │   Custom   │
│                  │                  │                  │   Metrics  │
└────────┬─────────┴────────┬─────────┴────────┬─────────┴─────┬──────┘
         │                  │                  │               │
         ▼                  ▼                  ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       MetricsService                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Buffer    │  │    Retry    │  │  Dimensions │                  │
│  │ (20 metrics)│  │   Logic     │  │  Management │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AWS CloudWatch                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Metrics   │  │  Dashboards │  │   Alarms    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# In your service directory
pnpm add @skillancer/metrics
```

### Peer Dependencies

```bash
pnpm add @aws-sdk/client-cloudwatch
```

## Quick Start

### Basic Usage

```typescript
import { createMetricsService } from '@skillancer/metrics';

// Create a metrics service instance
const metrics = createMetricsService({
  namespace: 'Skillancer/Services',
  environment: 'production',
  serviceName: 'api-gateway',
  region: 'us-east-1',
});

// Record a custom metric
metrics.record({
  name: 'CustomEvent',
  value: 1,
  unit: 'Count',
});

// Track timing
const stopTimer = metrics.startTimer('DatabaseQuery');
// ... perform database operation
const duration = stopTimer(); // Returns duration in ms

// Increment a counter
metrics.increment('CacheHit');

// Record a gauge value
metrics.gauge('ActiveConnections', 42);

// Graceful shutdown
await metrics.shutdown();
```

## MetricsService API

### Configuration

```typescript
interface MetricsOptions {
  namespace: string; // CloudWatch namespace
  environment: string; // Environment (dev, staging, production)
  serviceName: string; // Service identifier
  region?: string; // AWS region
  enabled?: boolean; // Enable/disable metrics (default: true)
  flushIntervalMs?: number; // Auto-flush interval (default: 60000)
  maxBufferSize?: number; // Buffer size before flush (default: 20)
  defaultDimensions?: Record<string, string>; // Global dimensions
}
```

### Core Methods

#### `record(data: MetricData): void`

Record a metric with custom value and unit.

```typescript
metrics.record({
  name: 'OrderProcessed',
  value: 1,
  unit: 'Count',
  dimensions: { PaymentMethod: 'credit_card' },
});
```

#### `increment(name: string, dimensions?: Record<string, string>): void`

Increment a counter by 1.

```typescript
metrics.increment('LoginAttempts', { Result: 'success' });
```

#### `timing(name: string, value: number, dimensions?: Record<string, string>): void`

Record a timing metric in milliseconds.

```typescript
const start = Date.now();
// ... operation
metrics.timing('QueryDuration', Date.now() - start, { Table: 'users' });
```

#### `gauge(name: string, value: number, dimensions?: Record<string, string>): void`

Record a gauge (point-in-time) value.

```typescript
metrics.gauge('QueueDepth', 150, { Queue: 'notifications' });
```

#### `histogram(name: string, value: number, dimensions?: Record<string, string>): void`

Record a histogram value (same as timing but semantic difference).

```typescript
metrics.histogram('ResponseSize', responseBody.length, { Endpoint: '/api/users' });
```

#### `startTimer(name: string, dimensions?: Record<string, string>): () => number`

Start a timer and return a function to stop it.

```typescript
const stop = metrics.startTimer('ExternalAPICall');
const response = await fetch(url);
const durationMs = stop(); // Automatically records the metric
```

#### `flush(): Promise<void>`

Manually flush buffered metrics to CloudWatch.

```typescript
await metrics.flush();
```

#### `shutdown(): Promise<void>`

Gracefully shutdown the metrics service.

```typescript
process.on('SIGTERM', async () => {
  await metrics.shutdown();
  process.exit(0);
});
```

## Framework Integrations

### Fastify Plugin

The Fastify plugin automatically records HTTP request metrics.

```typescript
import Fastify from 'fastify';
import { fastifyMetrics } from '@skillancer/metrics/fastify-plugin';

const app = Fastify();

await app.register(fastifyMetrics, {
  namespace: 'Skillancer/Services',
  environment: 'production',
  serviceName: 'api-gateway',
  // Optional: paths to ignore
  ignorePaths: ['/health', '/ready', '/metrics'],
  // Optional: custom dimension extractor
  extractDimensions: (request) => ({
    UserId: request.user?.id,
    TenantId: request.headers['x-tenant-id'],
  }),
});

// Metrics collected automatically:
// - RequestCount (with method, path, status)
// - RequestLatency (P50, P95, P99)
// - ErrorCount (4xx, 5xx errors)
```

### Express Middleware

```typescript
import express from 'express';
import {
  createExpressMetrics,
  createExpressErrorMetrics,
} from '@skillancer/metrics/express-middleware';

const app = express();

// Add metrics middleware (before routes)
app.use(
  createExpressMetrics({
    namespace: 'Skillancer/Services',
    environment: 'production',
    serviceName: 'web-app',
    ignorePaths: ['/health', '/ready'],
  })
);

// Your routes here...

// Add error metrics middleware (after routes)
app.use(createExpressErrorMetrics());
```

## Business Metrics

The `BusinessMetrics` class provides pre-defined metrics for Skillancer business events.

```typescript
import { createBusinessMetrics } from '@skillancer/metrics/business-metrics';

const business = createBusinessMetrics({
  namespace: 'Skillancer/Business',
  environment: 'production',
});

// User metrics
business.userSignup({ provider: 'email', userType: 'freelancer' });
business.userLogin({ provider: 'google' });

// Marketplace metrics
business.jobPosted({ category: 'web-development', budget: 5000 });
business.bidSubmitted({ category: 'web-development', amount: 4500 });
business.contractCreated({ category: 'web-development', value: 4500 });

// Payment metrics
business.paymentProcessed({
  amount: 4500,
  currency: 'USD',
  paymentMethod: 'stripe',
});

// Session metrics
business.sessionStarted();
business.sessionEnded({ duration: 1800 }); // 30 minutes

// Search metrics
business.searchPerformed({
  query: 'react developer',
  resultsCount: 25,
  filters: { category: 'web-development' },
});

// Messaging metrics
business.messagesSent({ count: 5, hasAttachment: true });
```

### Available Business Metrics

| Metric              | Description           | Dimensions              |
| ------------------- | --------------------- | ----------------------- |
| `UserSignup`        | New user registration | Provider, UserType      |
| `UserLogin`         | User authentication   | Provider                |
| `JobPosted`         | New job listing       | Category, Budget        |
| `BidSubmitted`      | Freelancer bid        | Category, Amount        |
| `ContractCreated`   | Contract formed       | Category, Value         |
| `ContractCompleted` | Work delivered        | Category, Value         |
| `PaymentProcessed`  | Payment completed     | PaymentMethod, Currency |
| `PaymentFailed`     | Payment failed        | PaymentMethod, Reason   |
| `SessionStarted`    | User session start    | -                       |
| `SessionEnded`      | User session end      | Duration                |
| `SearchPerformed`   | Search executed       | HasResults              |
| `MessagesSent`      | Messages sent         | HasAttachment           |

## CloudWatch Dashboards

Three dashboards are created by the Terraform module:

### 1. Platform Overview Dashboard

Provides operational visibility into platform health:

- **Request Metrics**: Total requests, requests by service
- **Latency Metrics**: P50, P95, P99 latencies
- **Error Metrics**: Error counts, error rates by service
- **Infrastructure**: ECS CPU/Memory, RDS metrics, Redis metrics

### 2. Business Metrics Dashboard

Tracks business KPIs:

- **User Metrics**: Signups, logins, active sessions
- **Marketplace**: Jobs posted, bids submitted, contracts created
- **Revenue**: Payments processed, GMV, payment failures
- **Engagement**: Search volume, messages sent

### 3. SLO Dashboard

Monitors Service Level Objectives:

- **Availability Gauge**: Current availability vs 99.9% target
- **Latency Gauge**: P95 latency vs 500ms target
- **Error Budget**: Remaining error budget for the month
- **SLO Trends**: 7-day rolling availability and latency

## Alarms and Alerting

### Application Alarms

| Alarm               | Threshold           | Severity |
| ------------------- | ------------------- | -------- |
| High Error Rate     | > 5% for 15 min     | Warning  |
| Critical Error Rate | > 10% for 10 min    | Critical |
| High Latency        | P95 > 1s for 15 min | Warning  |
| Critical Latency    | P95 > 3s for 10 min | Critical |
| Low Availability    | < 99.9% for 10 min  | Warning  |

### Infrastructure Alarms

| Alarm                | Threshold        | Severity |
| -------------------- | ---------------- | -------- |
| ECS CPU High         | > 80% for 15 min | Warning  |
| ECS Memory High      | > 80% for 15 min | Warning  |
| ECS No Tasks         | < 1 task         | Critical |
| RDS CPU High         | > 80% for 15 min | Warning  |
| RDS Connections High | > 100 for 10 min | Warning  |
| RDS Storage Low      | < 10GB           | Critical |
| Redis CPU High       | > 80% for 15 min | Warning  |
| Redis Memory High    | > 80% for 10 min | Warning  |
| Redis Evictions      | > 100 in 5 min   | Warning  |

### Alert Routing

```
Standard Alarms → SNS Topic (alarms) → Email/Slack
Critical Alarms → SNS Topic (critical-alarms) → PagerDuty/Phone
```

## SLOs and Error Budgets

### Defined SLOs

| SLI          | Target  | Measurement Window |
| ------------ | ------- | ------------------ |
| Availability | 99.9%   | 30 days rolling    |
| P95 Latency  | < 500ms | 30 days rolling    |

### Error Budget Calculation

```
Monthly Error Budget = Total Requests × (1 - SLO Target)
Example: 1,000,000 requests/month × 0.001 = 1,000 allowed errors

Remaining Budget = Error Budget - Actual Errors
Burn Rate = Actual Errors / Expected Errors (at current rate)
```

### SLO Alerting Strategy

1. **Budget Consumption > 50%**: Early warning, review recent changes
2. **Budget Consumption > 80%**: Freeze non-critical deployments
3. **Budget Exhausted**: Incident response, rollback if needed

## Best Practices

### 1. Use Appropriate Metric Types

```typescript
// ✅ Counters for events
metrics.increment('OrderReceived');

// ✅ Timings for durations
metrics.timing('QueryDuration', elapsed);

// ✅ Gauges for current values
metrics.gauge('ActiveConnections', pool.size);

// ❌ Don't use gauges for events
metrics.gauge('OrderReceived', 1); // Wrong!
```

### 2. Choose Meaningful Dimensions

```typescript
// ✅ Good: Bounded, meaningful dimensions
metrics.increment('APICall', {
  Endpoint: '/api/users',
  Method: 'GET',
  StatusClass: '2xx',
});

// ❌ Bad: Unbounded dimensions (high cardinality)
metrics.increment('APICall', {
  UserId: user.id, // Millions of unique values!
  RequestId: req.id, // Every request is unique!
});
```

### 3. Consistent Naming Conventions

```typescript
// Use PascalCase for metric names
'RequestCount'; // ✅
'request_count'; // ❌
'request-count'; // ❌

// Use descriptive names
'DatabaseQueryLatency'; // ✅
'DBLat'; // ❌

// Include unit in name when not obvious
'ResponseSizeBytes'; // ✅
'CacheHitRate'; // ✅ (implies percentage)
```

### 4. Handle Graceful Shutdown

```typescript
import { createMetricsService } from '@skillancer/metrics';

const metrics = createMetricsService(config);

// Ensure metrics are flushed on shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await metrics.shutdown(); // Flushes remaining metrics
  process.exit(0);
});
```

### 5. Test Metrics in Development

```typescript
// Disable metrics in tests to avoid AWS calls
const metrics = createMetricsService({
  ...config,
  enabled: process.env.NODE_ENV !== 'test',
});
```

## Troubleshooting

### Metrics Not Appearing in CloudWatch

1. **Check IAM permissions**: Service needs `cloudwatch:PutMetricData`
2. **Verify namespace**: Ensure consistent namespace across services
3. **Check region**: Metrics are region-specific
4. **Review buffer**: Metrics may be buffered (wait for flush)

### High CloudWatch Costs

1. **Reduce cardinality**: Limit unique dimension combinations
2. **Increase buffer size**: Batch more metrics per API call
3. **Reduce flush frequency**: Increase `flushIntervalMs`
4. **Use aggregation**: Aggregate metrics client-side when possible

### Missing Historical Data

CloudWatch retains metrics based on resolution:

- 1-second resolution: 3 hours
- 1-minute resolution: 15 days
- 5-minute resolution: 63 days
- 1-hour resolution: 455 days

Use CloudWatch Metric Streams for long-term storage if needed.

## Related Documentation

- [Centralized Logging Guide](./logging.md)
- [AWS CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [Infrastructure Setup](./infrastructure.md)
