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
5. **Notification** - Send Slack notification

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
- Slack notification is sent

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

| Secret              | Description                                |
| ------------------- | ------------------------------------------ |
| `SLACK_WEBHOOK_URL` | Slack webhook for deployment notifications |

## Services

The following services are deployed:

| Service          | Description                    |
| ---------------- | ------------------------------ |
| api-gateway      | API Gateway / Main entry point |
| auth-svc         | Authentication service         |
| market-svc       | Marketplace service            |
| skillpod-svc     | SkillPod service               |
| cockpit-svc      | Cockpit/Admin service          |
| billing-svc      | Billing service                |
| notification-svc | Notification service           |
| audit-svc        | Audit logging service          |

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

| Endpoint         | Expected | Description        |
| ---------------- | -------- | ------------------ |
| `/health`        | 200      | Basic health check |
| `/ready`         | 200      | Readiness check    |
| `/api/v1/status` | 200      | API status         |

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
- Slack notifications for all deployment events
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
