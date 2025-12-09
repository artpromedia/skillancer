# Alerting Runbook

This runbook covers the alerting system for Skillancer, including PagerDuty integration, incident response procedures, and alert management.

## Overview

Skillancer uses a multi-tier alerting system:

1. **CloudWatch Alarms** - Infrastructure and application metrics
2. **Sentry Alerts** - Application errors and exceptions
3. **PagerDuty** - Incident management and on-call escalation

## Alert Flow

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐     ┌───────────┐
│ CloudWatch      │────▶│ SNS Topic   │────▶│ Lambda      │────▶│ PagerDuty │
│ Alarm           │     │             │     │ Forwarder   │     │           │
└─────────────────┘     └─────────────┘     └─────────────┘     └───────────┘

┌─────────────────┐     ┌─────────────┐
│ Application     │────▶│ PagerDuty   │
│ Code            │     │ Events API  │
└─────────────────┘     └─────────────┘
```

## Packages

### @skillancer/alerting

The alerting package providing PagerDuty integration.

```bash
pnpm add @skillancer/alerting
```

## Setup

### Initialize PagerDuty

```typescript
import { initPagerDuty } from '@skillancer/alerting';

initPagerDuty({
  routingKey: process.env.PAGERDUTY_ROUTING_KEY,
  enabled: process.env.NODE_ENV === 'production',
  defaultSource: 'skillancer-api',
  environment: process.env.NODE_ENV,
});
```

### Configuration Options

| Option          | Type    | Description                                    |
| --------------- | ------- | ---------------------------------------------- |
| `routingKey`    | string  | PagerDuty Events API v2 routing key (required) |
| `enabled`       | boolean | Enable/disable PagerDuty (default: true)       |
| `defaultSource` | string  | Default source for alerts                      |
| `environment`   | string  | Environment name                               |

## Triggering Alerts

### Basic Alert

```typescript
import { triggerAlert } from '@skillancer/alerting';

await triggerAlert({
  summary: 'Database connection pool exhausted',
  severity: 'critical',
  source: 'skillancer-api',
  component: 'database',
  group: 'infrastructure',
  customDetails: {
    poolSize: 100,
    activeConnections: 100,
    waitingRequests: 50,
  },
});
```

### Convenience Functions

```typescript
import {
  triggerCriticalAlert,
  triggerErrorAlert,
  triggerWarningAlert,
  triggerInfoAlert,
} from '@skillancer/alerting';

// Critical - immediate attention required
await triggerCriticalAlert('Payment processing failed', {
  source: 'payment-service',
  component: 'stripe',
  customDetails: { errorCode: 'card_declined' },
});

// Error - investigate soon
await triggerErrorAlert('High error rate detected', {
  source: 'api-gateway',
  customDetails: { errorRate: '5.2%' },
});

// Warning - monitor closely
await triggerWarningAlert('Memory usage above 80%', {
  source: 'worker-service',
  customDetails: { memoryUsage: '82%' },
});

// Info - for visibility
await triggerInfoAlert('Deployment started', {
  source: 'ci-cd',
  customDetails: { version: '2.1.0' },
});
```

### Service-Specific Alerts

```typescript
import { triggerDatabaseAlert, triggerAPIAlert, triggerSecurityAlert } from '@skillancer/alerting';

// Database alerts
await triggerDatabaseAlert('Connection timeout to primary database', 'critical', {
  host: 'db-primary.skillancer.com',
  timeout: '30s',
});

// API alerts
await triggerAPIAlert('Response time exceeds SLA', 'warning', {
  endpoint: '/api/users',
  p99Latency: '2.5s',
});

// Security alerts
await triggerSecurityAlert('Multiple failed authentication attempts', 'error', {
  ip: '192.168.1.1',
  attempts: 50,
});
```

## Alert Management

### Acknowledge Alert

```typescript
import { acknowledgeAlert } from '@skillancer/alerting';

// Acknowledge when investigation starts
await acknowledgeAlert('database-critical-connection-pool-exhausted');
```

### Resolve Alert

```typescript
import { resolveAlert } from '@skillancer/alerting';

// Resolve when issue is fixed
await resolveAlert('database-critical-connection-pool-exhausted');
```

### Deduplication Keys

Alerts with the same dedup key are grouped:

```typescript
import { createDedupKey, triggerAlert } from '@skillancer/alerting';

const dedupKey = createDedupKey(['api', 'high-latency', 'users-endpoint']);
// Result: 'api-high-latency-users-endpoint'

await triggerAlert({
  summary: 'High latency on /api/users',
  severity: 'warning',
  source: 'api-service',
  dedupKey, // Same dedup key = same incident
});
```

## CloudWatch Integration

### Terraform Setup

Enable PagerDuty in the monitoring module:

```hcl
module "monitoring" {
  source = "../modules/monitoring"

  project     = "skillancer"
  environment = "production"
  aws_region  = "eu-west-1"

  # Enable PagerDuty
  enable_pagerduty       = true
  pagerduty_routing_key  = var.pagerduty_routing_key
  pagerduty_source_prefix = "aws"
}
```

### Adding Alarms to PagerDuty

Route CloudWatch alarms to PagerDuty:

```hcl
resource "aws_cloudwatch_metric_alarm" "api_high_error_rate" {
  alarm_name          = "skillancer-prod-api-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "High 5XX error rate on API"

  # Send to PagerDuty
  alarm_actions = [module.monitoring.pagerduty_sns_topic_arn]
  ok_actions    = [module.monitoring.pagerduty_sns_topic_arn]
}
```

## Severity Guidelines

| Severity     | Response Time       | Examples                                   |
| ------------ | ------------------- | ------------------------------------------ |
| **Critical** | Immediate (< 5 min) | Service down, data loss, security breach   |
| **Error**    | Soon (< 30 min)     | High error rate, degraded performance      |
| **Warning**  | Monitor (< 2 hrs)   | Resource usage high, latency increasing    |
| **Info**     | Review (< 24 hrs)   | Deployment complete, scheduled maintenance |

## Alert Categories

### Infrastructure Alerts

| Alert                 | Severity | Threshold             |
| --------------------- | -------- | --------------------- |
| ECS CPU > 90%         | Critical | 2 consecutive periods |
| ECS Memory > 85%      | Warning  | 2 consecutive periods |
| RDS CPU > 80%         | Warning  | 3 consecutive periods |
| RDS Connections > 90% | Critical | 2 consecutive periods |
| RDS Storage < 10GB    | Critical | 1 period              |
| ALB 5XX > 1%          | Error    | 2 consecutive periods |
| ALB Latency p99 > 2s  | Warning  | 3 consecutive periods |

### Application Alerts

| Alert                 | Severity | Threshold             |
| --------------------- | -------- | --------------------- |
| Error rate > 5%       | Critical | 2 consecutive periods |
| Error rate > 1%       | Warning  | 3 consecutive periods |
| Latency p99 > 3s      | Error    | 2 consecutive periods |
| Queue depth > 10000   | Warning  | 2 consecutive periods |
| Failed jobs > 100/min | Error    | 2 consecutive periods |

## Incident Response

### Step 1: Acknowledge

1. Review the alert in PagerDuty
2. Click "Acknowledge" to stop escalation
3. Join incident channel if needed

### Step 2: Assess

1. Check dashboards for impact scope
2. Review recent deployments
3. Check related services

### Step 3: Communicate

1. Update incident status in PagerDuty
2. Notify stakeholders if customer-impacting
3. Create tracking ticket if needed

### Step 4: Mitigate

1. Implement fix or rollback
2. Scale resources if needed
3. Enable circuit breakers

### Step 5: Resolve

1. Verify fix with monitoring
2. Resolve alert in PagerDuty
3. Document in post-mortem

## PagerDuty Configuration

### Get Routing Key

1. Go to PagerDuty → Services → Your Service
2. Click "Integrations" tab
3. Add "Events API v2" integration
4. Copy the "Integration Key" (routing key)

### Set Up Escalation Policy

1. Create escalation policy with on-call schedule
2. Set response urgency based on service level
3. Configure escalation timeouts

### Environment Variables

| Variable                | Description                            |
| ----------------------- | -------------------------------------- |
| `PAGERDUTY_ROUTING_KEY` | Events API v2 routing key              |
| `PAGERDUTY_ENABLED`     | Enable/disable (default: true in prod) |

## Testing Alerts

### Test in Development

```typescript
import { initPagerDuty, triggerInfoAlert } from '@skillancer/alerting';

initPagerDuty({
  routingKey: process.env.PAGERDUTY_TEST_ROUTING_KEY,
  enabled: true,
  environment: 'test',
});

await triggerInfoAlert('Test alert - please ignore', {
  source: 'test-runner',
  customDetails: { purpose: 'Integration test' },
});
```

### Test CloudWatch Integration

```bash
# Trigger test alarm
aws cloudwatch set-alarm-state \
  --alarm-name "skillancer-staging-test-alarm" \
  --state-value ALARM \
  --state-reason "Testing PagerDuty integration"

# Reset to OK
aws cloudwatch set-alarm-state \
  --alarm-name "skillancer-staging-test-alarm" \
  --state-value OK \
  --state-reason "Test complete"
```

## Troubleshooting

### Alerts Not Triggering

1. Check `enabled` is `true`
2. Verify routing key is correct
3. Check Lambda function logs
4. Verify SNS subscription is active

### Too Many Alerts

1. Review severity assignments
2. Add deduplication keys
3. Adjust thresholds
4. Add alert aggregation

### Missing Context

1. Add custom details to alerts
2. Include relevant links
3. Set proper tags and groups

## Related Documentation

- [Error Tracking](./error-tracking.md) - Sentry integration
- [Metrics](./metrics.md) - CloudWatch metrics and dashboards
- [Tracing](./tracing.md) - Distributed tracing
- [Deployment Runbook](./deployment-runbook.md) - Deployment procedures

1. Add custom details to alerts
2. Include relevant links
3. Set proper tags and groups

## Related Documentation

- [Error Tracking](./error-tracking.md) - Sentry integration
- [Metrics](./metrics.md) - CloudWatch metrics and dashboards
- [Tracing](./tracing.md) - Distributed tracing
- [Deployment Runbook](./deployment-runbook.md) - Deployment procedures
