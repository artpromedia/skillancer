# Grafana Dashboards

This directory contains pre-built Grafana dashboards for monitoring the Skillancer platform.

## Dashboards

### Platform Overview (`platform-overview.json`)

Real-time overview of all platform services with:

- Service health status and uptime
- Request rates and error rates across services
- P95 latency trends
- SLO compliance summary
- Infrastructure metrics (CPU, memory)

**Use Cases:**

- Daily operational monitoring
- Quick health checks
- Executive summaries

### SLO Dashboard (`slo-dashboard.json`)

Service Level Objectives tracking with:

- Current SLI gauges
- Error budget consumption
- Burn rate analysis (multi-window)
- SLO status indicators
- Historical trends
- All SLOs summary table

**Use Cases:**

- SRE reliability monitoring
- Incident response
- Capacity planning
- Monthly SLO reviews

### Service Detail (`service-detail.json`)

Deep-dive metrics for individual services:

- Health metrics (uptime, request rate, error rate)
- Latency distribution (P50, P95, P99)
- Latency heatmap
- Traffic by endpoint
- Status code distribution
- Resource utilization (CPU, memory, event loop)
- Dependency health (database, cache, external APIs)

**Use Cases:**

- Debugging performance issues
- Capacity planning
- Root cause analysis
- Service optimization

### Business Metrics (`business-metrics.json`)

Key business KPIs:

- Revenue and transactions
- Payment success rates
- User activity and registrations
- SkillPod metrics (enrollments, completions, learning time)
- Market metrics (jobs, proposals, contracts, GMV)
- Revenue trends and distribution

**Use Cases:**

- Business reporting
- Product analytics
- Executive dashboards

## Template Variables

All dashboards support the following template variables:

| Variable       | Description                              | Used In             |
| -------------- | ---------------------------------------- | ------------------- |
| `$environment` | Environment filter (production, staging) | All dashboards      |
| `$service`     | Service selector                         | Service Detail, SLO |
| `$slo`         | SLO selector                             | SLO Dashboard       |

## Data Sources

The dashboards require the following data sources:

- **Prometheus**: Primary metrics (required)
- **Loki**: Log aggregation (optional)
- **Tempo**: Distributed tracing (optional)
- **PostgreSQL**: Business analytics (optional)

## Installation

### Manual Import

1. Open Grafana UI
2. Go to Dashboards → Import
3. Upload the JSON file or paste contents
4. Select appropriate data sources
5. Click Import

### Provisioning (Recommended)

Copy files to Grafana's provisioning directory:

```bash
# Copy dashboards
cp dashboards/*.json /var/lib/grafana/dashboards/

# Configure dashboard provider
cp provisioning/dashboards/dashboards.yml /etc/grafana/provisioning/dashboards/

# Configure data sources
cp provisioning/datasources/datasources.yml /etc/grafana/provisioning/datasources/
```

### Docker Compose

Mount dashboards as volumes:

```yaml
services:
  grafana:
    image: grafana/grafana:10.0.0
    volumes:
      - ./dashboards:/var/lib/grafana/dashboards
      - ./provisioning/dashboards:/etc/grafana/provisioning/dashboards
      - ./provisioning/datasources:/etc/grafana/provisioning/datasources
```

## SLO Definitions

The platform defines the following SLOs:

| Service  | SLO                 | Target      | Window |
| -------- | ------------------- | ----------- | ------ |
| SkillPod | Availability        | 99.9%       | 30d    |
| SkillPod | Video Latency       | 95% < 2s    | 30d    |
| SkillPod | Content Delivery    | 99.5%       | 30d    |
| Market   | Availability        | 99.9%       | 30d    |
| Market   | Search Latency      | 95% < 500ms | 30d    |
| Market   | Matching Success    | 95%         | 30d    |
| Cockpit  | Availability        | 99.9%       | 30d    |
| Cockpit  | Report Generation   | 95% < 5s    | 30d    |
| Payment  | Transaction Success | 99.95%      | 30d    |
| Payment  | Payout Latency      | 99% < 1s    | 30d    |
| Auth     | Availability        | 99.99%      | 30d    |
| Auth     | Login Latency       | 99% < 500ms | 30d    |

## API Endpoints

Access SLO data programmatically:

```bash
# Get all SLO statuses
GET /api/slo/status

# Get specific SLO status
GET /api/slo/status/{sloId}

# Generate SLO report
GET /api/slo/report?period=24h

# List available dashboards
GET /api/observability/dashboards

# Get Prometheus metrics
GET /api/observability/metrics
```

## Alerting

Each SLO is configured with multi-window burn rate alerting:

| Alert  | Fast Window | Slow Window | Burn Rate  |
| ------ | ----------- | ----------- | ---------- |
| Page   | 1 hour      | 6 hours     | 14.4x / 6x |
| Ticket | 6 hours     | 3 days      | 6x / 1x    |

## Customization

### Adding New Panels

1. Edit dashboard in Grafana UI
2. Add panels with desired visualizations
3. Export updated JSON
4. Replace file in this directory
5. Commit changes

### Creating Service-Specific Dashboards

1. Copy `service-detail.json` as template
2. Update UID and title
3. Customize panels for service needs
4. Add to provisioning

## Troubleshooting

### No Data Displayed

1. Verify data source connectivity
2. Check time range selection
3. Confirm metrics are being scraped
4. Validate label values in queries

### Slow Dashboard Loading

1. Reduce time range
2. Increase step interval
3. Optimize PromQL queries
4. Check Prometheus resources

### Template Variables Not Loading

1. Verify data source is accessible
2. Check label_values query
3. Confirm metrics exist with expected labels
