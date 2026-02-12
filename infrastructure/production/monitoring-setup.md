# Production Monitoring Setup

Complete guide for monitoring setup and dashboard configuration.

## Dashboards Required

### 1. Executive Dashboard

**URL:** `https://grafana.skillancer.com/d/executive`

**Purpose:** High-level business and health metrics for leadership

#### Panels

| Panel               | Metric                    | Source      |
| ------------------- | ------------------------- | ----------- |
| Active Users        | Real-time connected users | Redis       |
| Daily Active Users  | Unique users last 24h     | PostgreSQL  |
| Revenue (MTD)       | Month-to-date revenue     | Stripe API  |
| Jobs Posted (Today) | New jobs count            | PostgreSQL  |
| Contracts Active    | Active contract count     | PostgreSQL  |
| Error Rate          | HTTP 5xx rate             | Prometheus  |
| Uptime              | Service availability      | Prometheus  |
| NPS Score           | Customer satisfaction     | Survey data |

#### Configuration

```json
{
  "dashboard": {
    "title": "Executive Dashboard",
    "refresh": "5m",
    "time": { "from": "now-24h", "to": "now" }
  },
  "panels": [
    {
      "title": "Active Users",
      "type": "stat",
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "sum(skillancer_active_sessions)"
        }
      ]
    },
    {
      "title": "Revenue MTD",
      "type": "stat",
      "datasource": "PostgreSQL",
      "targets": [
        {
          "rawSql": "SELECT sum(amount) FROM payments WHERE created_at >= date_trunc('month', now())"
        }
      ]
    }
  ]
}
```

---

### 2. Engineering Dashboard

**URL:** `https://grafana.skillancer.com/d/engineering`

**Purpose:** Technical health and performance monitoring

#### Panels

| Panel                | Metric               | Alert Threshold      |
| -------------------- | -------------------- | -------------------- |
| Request Rate         | HTTP requests/sec    | N/A                  |
| Error Rate           | 5xx errors %         | > 1% warn, > 5% crit |
| Response Time (p50)  | Median latency       | N/A                  |
| Response Time (p95)  | 95th percentile      | > 500ms warn         |
| Response Time (p99)  | 99th percentile      | > 1000ms crit        |
| CPU Usage            | Container CPU %      | > 70% warn           |
| Memory Usage         | Container memory %   | > 80% warn           |
| Database Connections | Active connections   | > 80% capacity       |
| Database Latency     | Query response time  | > 100ms warn         |
| Redis Memory         | Cache memory usage   | > 80% warn           |
| Queue Depth          | Background job queue | > 1000 warn          |

#### Service Health Grid

```yaml
# Per-service health indicators
services:
  - name: api-gateway
    health_endpoint: /health
    expected_replicas: 3
  - name: auth-svc
    health_endpoint: /health
    expected_replicas: 3
  - name: market-svc
    health_endpoint: /health
    expected_replicas: 3
  - name: skillpod-svc
    health_endpoint: /health
    expected_replicas: 2
  - name: billing-svc
    health_endpoint: /health
    expected_replicas: 2
  - name: notification-svc
    health_endpoint: /health
    expected_replicas: 2
```

#### Key Queries

```promql
# Request rate by service
sum(rate(http_requests_total[5m])) by (service)

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m])) * 100

# Response time p95
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# Database connections
pg_stat_activity_count{datname="skillancer"}
```

---

### 3. Security Dashboard

**URL:** `https://grafana.skillancer.com/d/security`

**Purpose:** Security monitoring and threat detection

#### Panels

| Panel                | Metric                   | Alert     |
| -------------------- | ------------------------ | --------- |
| Failed Logins        | Failed auth attempts/min | > 50/min  |
| Successful Logins    | Successful auth/min      | N/A       |
| Brute Force Attempts | Blocked IPs              | > 10/hour |
| WAF Blocks           | Blocked requests         | > 100/min |
| API Abuse            | Rate limit hits          | > 50/min  |
| Suspicious IPs       | Known bad actors         | Any       |
| Certificate Expiry   | Days until expiry        | < 30 days |
| Security Violations  | Policy violations        | Any       |

#### Failed Login Analysis

```promql
# Failed logins by reason
sum(rate(auth_login_failed_total[5m])) by (reason)

# Failed logins by IP (top 10)
topk(10, sum(rate(auth_login_failed_total[1h])) by (ip))

# Geographic anomalies
auth_login_success_total{country!~"US|CA|GB|DE|FR"}
```

#### WAF Monitoring

```promql
# Blocked requests by rule
sum(rate(waf_blocked_requests_total[5m])) by (rule_id)

# Attack types
sum(rate(waf_blocked_requests_total[1h])) by (attack_type)
```

---

## Alerts Configuration

### Priority Routing

| Priority      | Channels                    | Response Time     |
| ------------- | --------------------------- | ----------------- |
| P0 - Critical | PagerDuty + Webhook + Email | Immediate         |
| P1 - High     | Webhook + Email             | 30 minutes        |
| P2 - Medium   | Webhook                     | 2 hours           |
| P3 - Low      | Dashboard only              | Next business day |

### Alert Rules

#### P0 - Critical Alerts

```yaml
# Service down
- alert: ServiceDown
  expr: up == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: '{{ $labels.service }} is down'
    runbook: 'https://docs.skillancer.com/runbooks/service-down'

# Database unavailable
- alert: DatabaseUnavailable
  expr: pg_up == 0
  for: 30s
  labels:
    severity: critical
  annotations:
    summary: 'PostgreSQL database is unavailable'

# High error rate
- alert: HighErrorRate
  expr: |
    sum(rate(http_requests_total{status=~"5.."}[5m])) 
    / sum(rate(http_requests_total[5m])) > 0.05
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: 'Error rate above 5%'

# Payment processing failed
- alert: PaymentProcessingDown
  expr: stripe_api_errors_total > 10
  for: 5m
  labels:
    severity: critical
```

#### P1 - High Alerts

```yaml
# High latency
- alert: HighLatency
  expr: |
    histogram_quantile(0.95, 
      sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
    ) > 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: 'API p95 latency above 1 second'

# Database connection pool exhaustion
- alert: DatabaseConnectionsHigh
  expr: |
    pg_stat_activity_count{datname="skillancer"} 
    / pg_settings{name="max_connections"} > 0.8
  for: 5m
  labels:
    severity: warning

# Memory pressure
- alert: HighMemoryUsage
  expr: |
    container_memory_working_set_bytes 
    / container_spec_memory_limit_bytes > 0.85
  for: 5m
  labels:
    severity: warning
```

#### P2 - Medium Alerts

```yaml
# Queue backlog
- alert: QueueBacklog
  expr: job_queue_depth > 1000
  for: 15m
  labels:
    severity: warning

# Cache hit ratio low
- alert: CacheHitRatioLow
  expr: |
    sum(rate(redis_keyspace_hits_total[5m])) 
    / (sum(rate(redis_keyspace_hits_total[5m])) 
       + sum(rate(redis_keyspace_misses_total[5m]))) < 0.7
  for: 30m
  labels:
    severity: warning
```

### PagerDuty Integration

```yaml
# Alertmanager configuration
receivers:
  - name: pagerduty-critical
    pagerduty_configs:
      - service_key: $PAGERDUTY_SERVICE_KEY
        severity: critical
        description: '{{ .CommonAnnotations.summary }}'

  - name: webhook-warnings
    webhook_configs:
      - url: $ALERT_WEBHOOK_URL
        send_resolved: true

route:
  receiver: webhook-warnings
  routes:
    - match:
        severity: critical
      receiver: pagerduty-critical
```

---

## SLOs (Service Level Objectives)

### Availability

| Service          | Target | Measurement          |
| ---------------- | ------ | -------------------- |
| Overall Platform | 99.9%  | Monthly uptime       |
| API Gateway      | 99.95% | Successful responses |
| Authentication   | 99.99% | Login success rate   |
| Payments         | 99.99% | Transaction success  |

### Latency

| Endpoint Type     | p50   | p95    | p99    |
| ----------------- | ----- | ------ | ------ |
| Read operations   | 50ms  | 200ms  | 500ms  |
| Write operations  | 100ms | 300ms  | 800ms  |
| Search operations | 100ms | 500ms  | 1000ms |
| File uploads      | 500ms | 2000ms | 5000ms |

### Error Rate

| Category            | Target  |
| ------------------- | ------- |
| Client errors (4xx) | < 5%    |
| Server errors (5xx) | < 0.1%  |
| Payment errors      | < 0.01% |

### SLO Dashboard

```yaml
# Error budget calculation
error_budget_remaining:
  expr: |
    1 - (
      sum(increase(http_requests_total{status=~"5.."}[30d])) 
      / sum(increase(http_requests_total[30d]))
    ) / (1 - 0.999)

# Burn rate
error_budget_burn_rate:
  expr: |
    sum(rate(http_requests_total{status=~"5.."}[1h])) 
    / sum(rate(http_requests_total[1h])) 
    / 0.001
```

---

## Setup Instructions

### 1. Deploy Prometheus

```bash
helm install prometheus prometheus-community/prometheus \
  --namespace monitoring \
  --values prometheus-values.yaml
```

### 2. Deploy Grafana

```bash
helm install grafana grafana/grafana \
  --namespace monitoring \
  --values grafana-values.yaml
```

### 3. Import Dashboards

```bash
# Import pre-built dashboards
./scripts/import-dashboards.sh

# Dashboards imported:
# - Executive Dashboard
# - Engineering Dashboard
# - Security Dashboard
# - Database Dashboard
# - CDN Dashboard
```

### 4. Configure Alertmanager

```bash
kubectl apply -f alertmanager-config.yaml
```

### 5. Verify Setup

```bash
# Check all components
./scripts/verify-monitoring.sh

# Expected output:
# ✅ Prometheus: healthy
# ✅ Grafana: healthy
# ✅ Alertmanager: healthy
# ✅ All dashboards: loaded
# ✅ All alerts: configured
```

---

## Maintenance

### Weekly Tasks

- [ ] Review alert noise/fatigue
- [ ] Check dashboard accuracy
- [ ] Verify data retention

### Monthly Tasks

- [ ] Review SLO compliance
- [ ] Update alert thresholds
- [ ] Audit dashboard access

### Quarterly Tasks

- [ ] Review and update SLOs
- [ ] Performance baseline update
- [ ] Capacity planning review
