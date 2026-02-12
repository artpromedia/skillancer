# Production Deployment Documentation

This document describes the production deployment pipeline for Skillancer.

## Overview

The deployment pipeline follows a staged approach:

1. **Push to main** → Automatic deployment to **staging**
2. **Manual approval** → Deployment to **production**
3. **Health checks** → Automatic rollback on failure

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Prepare   │────▶│    Build    │────▶│   Staging   │────▶│ Production  │
│  Deployment │     │   Images    │     │   Deploy    │     │   Deploy    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │                    │
                                              ▼                    ▼
                                        ┌───────────┐        ┌───────────┐
                                        │  Health   │        │  Health   │
                                        │  Checks   │        │  Checks   │
                                        └───────────┘        └───────────┘
                                                                   │
                                                                   ▼
                                                             ┌───────────┐
                                                             │ Rollback  │
                                                             │ on Fail   │
                                                             └───────────┘
```

## Deployment Flow

### Automatic Deployment (Push to main)

When code is merged to `main`:

1. **Prepare** - Generate version, determine services, create changelog
2. **Build** - Build Docker images for all services
3. **Deploy to Staging** - Deploy to staging environment
4. **Health Checks** - Verify staging deployment
5. **Notification** - Send deployment notification

### Manual Production Deployment

To deploy to production:

1. Go to **Actions** → **Deploy** workflow
2. Click **Run workflow**
3. Select `production` as the environment
4. Choose services to deploy (or "all")
5. Click **Run workflow**
6. **Approve** the deployment when prompted

### Rollback

If production deployment fails:

- Automatic rollback is triggered
- Services are restored to previous versions
- Notification is sent

For manual rollback:

1. Go to **Actions** → **Manual Rollback** workflow
2. Select environment and service
3. Optionally specify a version
4. Provide a reason for the rollback

## Environments

### Staging

- **URL**: https://api-staging.skillancer.com
- **Cluster**: skillancer-staging
- **Auto-deploy**: Yes (on push to main)
- **Protection**: None

### Production

- **URL**: https://api.skillancer.com
- **Cluster**: skillancer-prod
- **Auto-deploy**: No
- **Protection**: Required reviewers

## GitHub Environment Configuration

### Staging Environment

```yaml
Name: staging
Protection rules: None
Deployment branches: main
```

### Production Environment

```yaml
Name: production
Protection rules:
  - Required reviewers: 2
  - Deployment branches: main only
  - Wait timer: 0 minutes (optional: add delay)
```

## Required Secrets

Configure these secrets in GitHub repository settings:

### AWS Credentials

| Secret                  | Description                             |
| ----------------------- | --------------------------------------- |
| `AWS_ACCOUNT_ID`        | AWS account ID                          |
| `AWS_ACCESS_KEY_ID`     | AWS access key with ECS/ECR permissions |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key                   |

### Notifications

| Secret              | Description                              |
| ------------------- | ---------------------------------------- |
| `ALERT_WEBHOOK_URL` | Webhook URL for deployment notifications |

## Services

The following services are deployed:

### Core Services

| Service          | Port | Description                    |
| ---------------- | ---- | ------------------------------ |
| api-gateway      | 4000 | API Gateway / Main entry point |
| auth-svc         | 3001 | Authentication service         |
| market-svc       | 3002 | Marketplace service            |
| skillpod-svc     | 3003 | SkillPod service               |
| cockpit-svc      | 3004 | Cockpit/CRM service            |
| billing-svc      | 3005 | Billing service                |
| notification-svc | 4006 | Notification service           |
| audit-svc        | 3012 | Audit logging service          |

### Moat Services (Competitive Advantage Features)

| Service          | Port | Description                              |
| ---------------- | ---- | ---------------------------------------- |
| executive-svc    | 3007 | Enterprise client management             |
| financial-svc    | 3008 | Financial services (cards, financing)    |
| talent-graph-svc | 3009 | Professional network and introductions   |
| intelligence-svc | 3010 | Analytics, predictions, and benchmarking |
| copilot-svc      | 3011 | AI-powered proposal and rate assistance  |

## Deployment Strategies

### Staging: Rolling Update

- Minimum healthy: 100%
- Maximum: 200%
- Fast deployment
- No downtime

### Production: Blue-Green (via CodeDeploy)

- Traffic shifted gradually
- Automatic rollback on failure
- Zero downtime
- Ability to test before switching

## Health Checks

### Endpoints Checked

| Endpoint            | Expected | Description                          |
| ------------------- | -------- | ------------------------------------ |
| `/health`           | 200      | Basic health check                   |
| `/health/live`      | 200      | Liveness probe (is process alive)    |
| `/health/ready`     | 200      | Readiness probe (can handle traffic) |
| `/health/dashboard` | 200      | Aggregated health of all services    |
| `/health/circuits`  | 200      | Circuit breaker status               |
| `/api/v1/status`    | 200      | API status                           |

### Health Dashboard

The `/health/dashboard` endpoint provides comprehensive health status:

```json
{
  "overall": "healthy | degraded | critical | down",
  "timestamp": "2026-01-02T00:00:00.000Z",
  "uptime": 12345.67,
  "version": "1.0.0",
  "memory": { "heapUsed": 50, "heapTotal": 100, "rss": 150, "unit": "MB" },
  "summary": { "total": 11, "healthy": 11, "unhealthy": 0, "healthPercentage": 100 },
  "coreServices": { "auth": {...}, "market": {...}, ... },
  "moatServices": { "executive": {...}, "financial": {...}, ... },
  "circuitBreakers": { ... }
}
```

Health thresholds:

- **healthy**: 100% of services responding
- **degraded**: 80-99% of services responding
- **critical**: 50-79% of services responding
- **down**: <50% of services responding

### Health Check Configuration

```yaml
Max Retries: 5 (staging), 10 (production)
Retry Delay: 15s (staging), 30s (production)
Timeout: 30s per request
```

## Scripts

### Deploy Script

```bash
# Deploy to staging
./scripts/deploy-ecs.sh staging api-gateway v1.0.0

# Deploy all services to production
./scripts/deploy-ecs.sh production all v1.0.0

# Dry run
./scripts/deploy-ecs.sh --dry-run staging api-gateway v1.0.0
```

### Health Check Script

```bash
# Basic health check
./scripts/health-check.sh staging

# Full health check with performance tests
./scripts/health-check.sh production --full

# Verbose output
./scripts/health-check.sh staging --verbose
```

### Rollback Script

```bash
# Rollback to previous version
./scripts/rollback.sh staging api-gateway

# Rollback to specific version
./scripts/rollback.sh production auth-svc v1.0.0

# Rollback all services
./scripts/rollback.sh production all
```

## Monitoring

### Deployment Tracking

- GitHub Actions workflow provides real-time status
- Webhook notifications for all deployment events
- AWS CloudWatch for ECS service metrics
- Deployment records stored in S3

### Key Metrics to Monitor

1. **ECS Service Health**
   - Running task count
   - Pending task count
   - Deployment status

2. **Application Health**
   - Response times
   - Error rates
   - Request throughput

3. **Infrastructure**
   - CPU utilization
   - Memory utilization
   - Network I/O

## Troubleshooting

### Deployment Stuck

1. Check ECS service events:

   ```bash
   aws ecs describe-services --cluster skillancer-prod --services api-gateway
   ```

2. Check task logs:

   ```bash
   aws logs tail /ecs/skillancer-prod-api-gateway --follow
   ```

3. Check for resource constraints

### Health Check Failing

1. Verify service is running:

   ```bash
   aws ecs list-tasks --cluster skillancer-prod --service-name api-gateway
   ```

2. Check service logs for errors

3. Verify database connectivity

4. Check environment variables

### Rollback Not Working

1. Verify previous task definition exists
2. Check IAM permissions
3. Manually rollback via AWS Console if needed

## Best Practices

1. **Always deploy to staging first**
2. **Monitor staging for at least 30 minutes before production**
3. **Deploy during low-traffic periods**
4. **Have a rollback plan ready**
5. **Keep deployment sizes small and frequent**
6. **Document all production deployments**

## Emergency Procedures

### Immediate Rollback

```bash
# Via GitHub Actions
# Go to Actions → Manual Rollback → Run with "production" and "all"

# Via AWS CLI
./scripts/rollback.sh -y production all
```

### Complete Service Stop

```bash
# Scale down all services
for service in api-gateway auth-svc market-svc; do
  aws ecs update-service \
    --cluster skillancer-prod \
    --service $service \
    --desired-count 0
done
```

### Database Issues

1. Switch to read-only mode if possible
2. Redirect traffic to maintenance page
3. Contact DBA team

## Local Development with Docker Compose

For local development and testing, use Docker Compose:

### Full Stack (All Services)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api-gateway

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Development Mode (Infrastructure Only)

For faster development with hot-reload on services:

```bash
# Start infrastructure only (postgres, redis)
docker-compose -f docker-compose.dev.yml up -d

# Run services locally with hot-reload
pnpm --filter api-gateway dev
pnpm --filter auth-svc dev
```

### Service URLs (Local)

| Service          | URL                   |
| ---------------- | --------------------- |
| API Gateway      | http://localhost:4000 |
| Auth Service     | http://localhost:3001 |
| Market Service   | http://localhost:3002 |
| SkillPod Service | http://localhost:3003 |
| Cockpit Service  | http://localhost:3004 |
| Billing Service  | http://localhost:3005 |
| Notification Svc | http://localhost:4006 |
| Executive Svc    | http://localhost:3007 |
| Financial Svc    | http://localhost:3008 |
| Talent Graph Svc | http://localhost:3009 |
| Intelligence Svc | http://localhost:3010 |
| Copilot Service  | http://localhost:3011 |
| PostgreSQL       | localhost:5432        |
| Redis            | localhost:6379        |

### Environment Configuration

Each service has a `.env.example` file. Copy and configure:

```bash
# Copy all .env.example files
for dir in services/*/; do
  if [ -f "${dir}.env.example" ]; then
    cp "${dir}.env.example" "${dir}.env"
  fi
done

# Edit as needed
vim services/api-gateway/.env
```

### Required Environment Variables

| Variable         | Description                    | Example                                  |
| ---------------- | ------------------------------ | ---------------------------------------- |
| DATABASE_URL     | PostgreSQL connection string   | postgresql://user:pass@localhost:5432/db |
| REDIS_URL        | Redis connection string        | redis://localhost:6379                   |
| JWT_SECRET       | JWT signing secret (32+ chars) | your-secure-secret-here                  |
| SENDGRID_API_KEY | SendGrid API key               | SG.xxxxxx                                |
