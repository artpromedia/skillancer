# @skillancer/bi

Business Intelligence and KPI Reporting package for the Skillancer platform.

## Features

- **KPI Tracking**: Real-time and historical KPI calculation with caching
- **Executive Dashboards**: Pre-built dashboard views for different stakeholders
- **Report Generation**: PDF, Excel, and CSV report generation
- **Alerting**: Threshold-based alerts with Slack/Email notifications
- **Insights**: AI-powered anomaly detection and trend analysis

## KPI Categories

| Category | KPIs |
|----------|------|
| Revenue | GMV, MRR, ARR, ARPU, LTV |
| Growth | DAU, WAU, MAU, Growth Rate |
| Retention | Retention Rate, Churn Rate |
| Marketplace | Job Completion, Time to Fill |
| Learning | Course Completion, Skill Adoption |

## Usage

```typescript
import { KPIService, ReportService, createBIRoutes } from '@skillancer/bi';

// Initialize services
const kpiService = new KPIService(clickhouse, redis);
const reportService = new ReportService(clickhouse, s3);

// Register routes
app.register(createBIRoutes(kpiService, reportService), { prefix: '/api/bi' });

// Calculate KPIs
const mrr = await kpiService.calculateKPI('mrr', startDate, endDate);

// Generate reports
const report = await reportService.generateReport('weekly-summary', startDate, endDate);
```

## API Endpoints

- `GET /kpis/:kpiId` - Get single KPI value
- `GET /kpis/:kpiId/timeseries` - Get KPI time series
- `POST /kpis/batch` - Get multiple KPIs
- `GET /dashboards/executive` - Executive dashboard
- `GET /dashboards/:category` - Category dashboard
- `POST /reports/generate` - Generate report
- `GET /reports` - List reports
