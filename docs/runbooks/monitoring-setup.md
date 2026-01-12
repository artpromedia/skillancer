# Monitoring and Alerting Setup Guide

This guide covers the setup, configuration, and management of monitoring and alerting infrastructure for Skillancer.

## Overview

Skillancer uses a comprehensive observability stack:

- **Metrics**: Prometheus + Grafana
- **Logging**: Loki + Grafana
- **Tracing**: OpenTelemetry + Jaeger
- **Alerting**: PagerDuty + Grafana Alerts
- **Uptime**: Synthetic monitoring via Checkly

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Application   │────▶│  OpenTelemetry  │────▶│   Collectors    │
│    Services     │     │      SDK        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                        ┌───────────────────────────────┼───────────────────────────────┐
                        │                               │                               │
                        ▼                               ▼                               ▼
                ┌───────────────┐              ┌───────────────┐              ┌───────────────┐
                │  Prometheus   │              │     Loki      │              │    Jaeger     │
                │   (Metrics)   │              │   (Logging)   │              │   (Tracing)   │
                └───────────────┘              └───────────────┘              └───────────────┘
                        │                               │                               │
                        └───────────────────────────────┼───────────────────────────────┘
                                                        │
                                                        ▼
                                                ┌───────────────┐
                                                │    Grafana    │
                                                │  (Dashboard)  │
                                                └───────────────┘
                                                        │
                                                        ▼
                                                ┌───────────────┐
                                                │   PagerDuty   │
                                                │  (Alerting)   │
                                                └───────────────┘
```

---

## Installing the Monitoring Stack

### Prerequisites

- Kubernetes cluster with kubectl access
- Helm 3.x installed
- Sufficient cluster resources (minimum 4GB RAM for monitoring)

### Step 1: Add Helm Repositories

```bash
# Add required Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm repo update
```

### Step 2: Create Monitoring Namespace

```bash
kubectl create namespace monitoring
kubectl label namespace monitoring name=monitoring
```

### Step 3: Install Prometheus Stack

```bash
# Install kube-prometheus-stack (includes Prometheus, Grafana, AlertManager)
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values infrastructure/kubernetes/monitoring/prometheus-values.yaml
```

**prometheus-values.yaml:**

```yaml
prometheus:
  prometheusSpec:
    retention: 30d
    retentionSize: 50GB
    resources:
      requests:
        memory: 2Gi
        cpu: 500m
      limits:
        memory: 4Gi
        cpu: 1000m
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 100Gi
    serviceMonitorSelector:
      matchLabels:
        prometheus: main
    additionalScrapeConfigs:
      - job_name: 'skillancer-services'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - skillancer-production
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)

grafana:
  enabled: true
  adminPassword: "REPLACE_WITH_SECURE_PASSWORD"
  persistence:
    enabled: true
    size: 10Gi
  ingress:
    enabled: true
    hosts:
      - metrics.skillancer.com
    tls:
      - secretName: metrics-tls
        hosts:
          - metrics.skillancer.com

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi
```

### Step 4: Install Loki for Logging

```bash
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set loki.persistence.enabled=true \
  --set loki.persistence.size=50Gi \
  --set promtail.enabled=true
```

### Step 5: Install Jaeger for Tracing

```bash
helm install jaeger jaegertracing/jaeger \
  --namespace monitoring \
  --set storage.type=elasticsearch \
  --set storage.elasticsearch.host=elasticsearch.monitoring.svc.cluster.local
```

---

## Configuring Service Monitoring

### Adding ServiceMonitor for New Service

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api-gateway-monitor
  namespace: monitoring
  labels:
    prometheus: main
spec:
  selector:
    matchLabels:
      app: api-gateway
  namespaceSelector:
    matchNames:
      - skillancer-production
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
      scrapeTimeout: 10s
```

### Required Application Metrics

Each service should expose these metrics at `/metrics`:

```
# HTTP metrics
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}
http_requests_in_flight

# Database metrics
db_query_duration_seconds{query_type}
db_connections_active
db_connections_idle
db_errors_total{error_type}

# Cache metrics
cache_hits_total
cache_misses_total
cache_evictions_total

# Business metrics
jobs_created_total
proposals_submitted_total
contracts_signed_total
payments_processed_total{status}
```

### Instrumenting Node.js Services

```typescript
import { initMetrics, httpMetrics, createHistogram, createCounter } from '@skillancer/metrics';

// Initialize metrics
initMetrics({
  serviceName: 'api-gateway',
  defaultLabels: {
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
  },
});

// Add HTTP metrics middleware
app.use(httpMetrics());

// Custom business metrics
const jobsCreated = createCounter({
  name: 'jobs_created_total',
  help: 'Total number of jobs created',
  labelNames: ['category'],
});

// Increment counter
jobsCreated.inc({ category: 'web-development' });
```

---

## Setting Up Alerts

### Alert Configuration in Prometheus

Create PrometheusRule resources:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: skillancer-alerts
  namespace: monitoring
  labels:
    prometheus: main
spec:
  groups:
    - name: skillancer.availability
      rules:
        - alert: ServiceDown
          expr: up{job=~"skillancer-.*"} == 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Service {{ $labels.job }} is down"
            description: "{{ $labels.job }} has been down for more than 1 minute"

        - alert: HighErrorRate
          expr: |
            sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
            / sum(rate(http_requests_total[5m])) by (service) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "High error rate on {{ $labels.service }}"
            description: "Error rate is {{ $value | humanizePercentage }}"

        - alert: HighLatency
          expr: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
            ) > 2
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High latency on {{ $labels.service }}"
            description: "P99 latency is {{ $value | humanizeDuration }}"

    - name: skillancer.resources
      rules:
        - alert: HighCPUUsage
          expr: |
            sum(rate(container_cpu_usage_seconds_total{namespace="skillancer-production"}[5m])) by (pod)
            / sum(container_spec_cpu_quota{namespace="skillancer-production"}/container_spec_cpu_period{namespace="skillancer-production"}) by (pod) > 0.9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High CPU usage on {{ $labels.pod }}"

        - alert: HighMemoryUsage
          expr: |
            sum(container_memory_working_set_bytes{namespace="skillancer-production"}) by (pod)
            / sum(container_spec_memory_limit_bytes{namespace="skillancer-production"}) by (pod) > 0.9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High memory usage on {{ $labels.pod }}"

        - alert: PodCrashLooping
          expr: increase(kube_pod_container_status_restarts_total{namespace="skillancer-production"}[1h]) > 5
          labels:
            severity: critical
          annotations:
            summary: "Pod {{ $labels.pod }} is crash looping"

    - name: skillancer.database
      rules:
        - alert: DatabaseConnectionPoolExhausted
          expr: db_connections_active / db_connections_max > 0.9
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "Database connection pool near capacity"

        - alert: SlowDatabaseQueries
          expr: histogram_quantile(0.99, sum(rate(db_query_duration_seconds_bucket[5m])) by (le)) > 1
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Database queries are slow"

    - name: skillancer.business
      rules:
        - alert: PaymentFailureSpike
          expr: |
            sum(rate(payments_processed_total{status="failed"}[5m]))
            / sum(rate(payments_processed_total[5m])) > 0.1
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Payment failure rate above 10%"

        - alert: NoJobsCreated
          expr: sum(increase(jobs_created_total[1h])) == 0
          for: 2h
          labels:
            severity: warning
          annotations:
            summary: "No jobs created in the last 2 hours"
```

### AlertManager Configuration

```yaml
# alertmanager-config.yaml
global:
  resolve_timeout: 5m
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

route:
  receiver: 'default'
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true
    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'default'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/XXX/YYY/ZZZ'
        channel: '#alerts'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - routing_key: 'YOUR_PAGERDUTY_ROUTING_KEY'
        severity: critical
        description: '{{ .CommonAnnotations.summary }}'
        details:
          firing: '{{ template "pagerduty.default.instances" .Alerts.Firing }}'

  - name: 'slack-warnings'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/XXX/YYY/ZZZ'
        channel: '#alerts-warnings'
        title: '{{ .CommonAnnotations.summary }}'
        text: '{{ .CommonAnnotations.description }}'
```

---

## Creating Grafana Dashboards

### Service Overview Dashboard

Import or create dashboards for:

1. **Service Health Dashboard**
   - Request rate
   - Error rate
   - P50/P90/P99 latency
   - Active pods
   - Resource utilization

2. **Business Metrics Dashboard**
   - Jobs created/hour
   - Proposals submitted/hour
   - Contracts signed/day
   - Payment volume
   - Active users

3. **Infrastructure Dashboard**
   - Node CPU/Memory
   - Pod resource usage
   - Network I/O
   - Disk usage
   - Database connections

### Example Dashboard JSON

```json
{
  "dashboard": {
    "title": "Skillancer Service Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{namespace=\"skillancer-production\"}[5m])) by (service)",
            "legendFormat": "{{ service }}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\",namespace=\"skillancer-production\"}[5m])) by (service) / sum(rate(http_requests_total{namespace=\"skillancer-production\"}[5m])) by (service)",
            "legendFormat": "{{ service }}"
          }
        ]
      },
      {
        "title": "P99 Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{namespace=\"skillancer-production\"}[5m])) by (le, service))",
            "legendFormat": "{{ service }}"
          }
        ]
      }
    ]
  }
}
```

---

## Synthetic Monitoring

### Checkly Configuration

Set up synthetic checks for critical endpoints:

```javascript
// checkly/api-health.check.js
const { ApiCheck, AssertionBuilder } = require('checkly/constructs');

new ApiCheck('api-health', {
  name: 'API Gateway Health',
  request: {
    method: 'GET',
    url: 'https://api.skillancer.com/health',
  },
  assertions: [
    AssertionBuilder.statusCode().equals(200),
    AssertionBuilder.responseTime().lessThan(500),
    AssertionBuilder.jsonBody('$.status').equals('healthy'),
  ],
  frequency: 1, // Every minute
  locations: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
});
```

### Uptime Checks

Configure for all critical endpoints:

| Endpoint | Frequency | Locations | Alert Threshold |
|----------|-----------|-----------|-----------------|
| `api.skillancer.com/health` | 1 min | 3 regions | 2 failures |
| `skillancer.com` | 1 min | 3 regions | 2 failures |
| `api.skillancer.com/auth/verify` | 5 min | 3 regions | 1 failure |
| `webhooks.skillancer.com/stripe` | 5 min | 1 region | 3 failures |

---

## Log Aggregation

### Querying Logs in Grafana/Loki

```logql
# Find errors in api-gateway
{namespace="skillancer-production", app="api-gateway"} |= "error"

# Find slow requests (> 1 second)
{namespace="skillancer-production"} | json | duration > 1000

# Find specific user's requests
{namespace="skillancer-production"} |= "user_id=usr_123"

# Count errors by service
sum by (app) (count_over_time({namespace="skillancer-production"} |= "error" [5m]))
```

### Log Retention Policy

| Log Type | Retention | Storage |
|----------|-----------|---------|
| Application logs | 30 days | Loki |
| Audit logs | 1 year | S3 + Glacier |
| Security logs | 2 years | S3 + Glacier |
| Debug logs | 7 days | Loki |

---

## Troubleshooting Monitoring Issues

### Prometheus Not Scraping Targets

```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets

# Check ServiceMonitor
kubectl get servicemonitor -n monitoring

# Check pod annotations
kubectl get pods -n skillancer-production -o yaml | grep -A5 "annotations:"
```

### Grafana Dashboard Not Loading

```bash
# Check Grafana logs
kubectl logs -n monitoring deployment/prometheus-grafana

# Verify datasources
kubectl get configmap -n monitoring | grep grafana-datasources
```

### Alerts Not Firing

```bash
# Check AlertManager
kubectl port-forward -n monitoring svc/prometheus-alertmanager 9093:9093
# Visit http://localhost:9093

# Check PrometheusRule
kubectl get prometheusrules -n monitoring

# Check alert state in Prometheus
# Visit http://localhost:9090/alerts
```

---

## Contacts

| Role | Contact |
|------|---------|
| SRE Team | #sre-oncall (Slack) |
| Platform Team | #platform (Slack) |
| PagerDuty Admin | @oncall-admin (Slack) |

## Related Documentation

- [Alerting Runbook](../alerting-runbook.md)
- [Metrics Documentation](../metrics.md)
- [Logging Documentation](../logging.md)
- [Tracing Documentation](../tracing.md)
- [Incident Response](./incident-response.md)
