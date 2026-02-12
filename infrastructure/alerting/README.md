# Alerting Infrastructure

This directory contains configuration files for the Skillancer platform's alerting infrastructure.

## Files

### alertmanager.yml

Alertmanager configuration for routing, grouping, and delivering alerts to various notification channels:

- **Webhook Notifications**:
  - General alerts
  - Critical issues requiring immediate attention
  - Non-critical warnings
  - Database-related alerts
  - Business metric alerts

- **PagerDuty Integration**:
  - Critical production issues
  - Security incidents

### prometheus-rules.yml

Prometheus alerting rules organized by category:

| Category         | Alert Examples                                          |
| ---------------- | ------------------------------------------------------- |
| **Availability** | ServiceDown, HighErrorRate, HealthCheckFailing          |
| **Performance**  | HighLatency, SlowDatabaseQueries, RequestQueueSaturated |
| **Resources**    | HighCPUUsage, HighMemoryUsage, DiskSpaceLow             |
| **Database**     | ConnectionPoolExhausted, ReplicationLag, HighDeadTuples |
| **Cache**        | RedisDown, LowCacheHitRate, RedisMemoryHigh             |
| **Business**     | PaymentFailures, SignupAnomaly, RevenueDropDetected     |
| **Security**     | BruteForce, RateLimitExceeded, SSLCertificateExpiring   |
| **Queues**       | BacklogGrowing, DeadLetterQueueNotEmpty, ConsumerLag    |

## Environment Variables

Set these environment variables before deploying:

```bash
# Alert Webhook
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.example.com/alerts

# PagerDuty
PAGERDUTY_SERVICE_KEY=your-service-key
PAGERDUTY_SECURITY_KEY=your-security-key
```

## Deployment

### Kubernetes

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
data:
  alertmanager.yml: |
    # Include contents of alertmanager.yml
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-rules
data:
  rules.yml: |
    # Include contents of prometheus-rules.yml
```

### Docker Compose

```yaml
services:
  alertmanager:
    image: prom/alertmanager:v0.26.0
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
    ports:
      - '9093:9093'

  prometheus:
    image: prom/prometheus:v2.48.0
    volumes:
      - ./prometheus-rules.yml:/etc/prometheus/rules/rules.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--alertmanager.url=http://alertmanager:9093'
```

## Testing Alerts

Use `amtool` to test alertmanager routing:

```bash
# Test alert routing
amtool config routes test --config.file=alertmanager.yml \
  alertname=ServiceDown severity=critical service=api-gateway

# Send a test alert
amtool alert add \
  alertname=TestAlert \
  severity=warning \
  service=test \
  --annotation.summary="Test alert" \
  --alertmanager.url=http://localhost:9093
```

## Runbooks

Each alert includes a `runbook_url` annotation linking to detailed troubleshooting steps:

- [Service Down](https://docs.skillancer.io/runbooks/service-down)
- [High Error Rate](https://docs.skillancer.io/runbooks/high-error-rate)
- [High Latency](https://docs.skillancer.io/runbooks/high-latency)
- [Database Connections](https://docs.skillancer.io/runbooks/db-connections)
- [Redis Down](https://docs.skillancer.io/runbooks/redis-down)
- [Payment Failures](https://docs.skillancer.io/runbooks/payment-failures)
- [Brute Force](https://docs.skillancer.io/runbooks/brute-force)
- [SSL Renewal](https://docs.skillancer.io/runbooks/ssl-renewal)

## Severity Levels

| Severity     | Response Time         | Examples                                           |
| ------------ | --------------------- | -------------------------------------------------- |
| **critical** | Immediate (PagerDuty) | Service down, payment failures, security incidents |
| **warning**  | Within hours          | High latency, elevated error rates, resource usage |
| **info**     | Business hours        | Anomaly detection, trend analysis                  |
