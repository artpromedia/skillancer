# Deploying ECS Services - Skillancer

This guide covers deploying new services and managing existing services on the Skillancer ECS infrastructure.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Deploying a New Service](#deploying-a-new-service)
- [Deployment Strategies](#deployment-strategies)
- [Service Discovery](#service-discovery)
- [Auto Scaling](#auto-scaling)
- [Monitoring & Debugging](#monitoring--debugging)
- [Cost Optimization](#cost-optimization)

## Architecture Overview

```
                                    ┌─────────────────────────────────────┐
                                    │           AWS Cloud                  │
┌──────────┐     ┌─────────────┐   │  ┌─────────────────────────────────┐ │
│  Users   │────▶│     ALB     │───┼─▶│      ECS Cluster (Fargate)      │ │
└──────────┘     └─────────────┘   │  │                                 │ │
                                    │  │  ┌─────────┐  ┌─────────┐       │ │
                                    │  │  │API GW   │  │Web Front│       │ │
                                    │  │  │Service  │  │Service  │       │ │
                                    │  │  └────┬────┘  └─────────┘       │ │
                                    │  │       │                         │ │
                                    │  │  ┌────▼────┐  ┌─────────┐       │ │
                                    │  │  │Auth     │  │Market   │       │ │
                                    │  │  │Service  │  │Service  │       │ │
                                    │  │  └─────────┘  └─────────┘       │ │
                                    │  │                                 │ │
                                    │  │  ┌─────────────────────┐        │ │
                                    │  │  │ Notification Worker │        │ │
                                    │  │  └─────────────────────┘        │ │
                                    │  └─────────────────────────────────┘ │
                                    │                                      │
                                    │  ┌──────────┐  ┌──────────────────┐ │
                                    │  │   RDS    │  │   ElastiCache    │ │
                                    │  │PostgreSQL│  │     (Redis)      │ │
                                    │  └──────────┘  └──────────────────┘ │
                                    └─────────────────────────────────────┘
```

## Prerequisites

1. **ECR Repository**: Container image must be pushed to ECR
2. **Secrets**: Service secrets must be stored in AWS Secrets Manager
3. **Networking**: VPC, subnets, and security groups must be provisioned
4. **IAM Roles**: Task execution and task roles must exist

## Deploying a New Service

### Step 1: Create ECR Repository

```hcl
# In modules/ecr/main.tf or environment config
module "ecr" {
  source = "../../modules/ecr"

  for_each = toset([
    "api-gateway",
    "auth-service",
    "market-service",
    "your-new-service"  # Add your service here
  ])

  repository_name = "skillancer/${each.key}"
  environment     = var.environment
}
```

### Step 2: Build and Push Container Image

```bash
# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -t skillancer/your-service:v1.0.0 .
docker tag skillancer/your-service:v1.0.0 <account-id>.dkr.ecr.us-east-1.amazonaws.com/skillancer/your-service:v1.0.0

# Push
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/skillancer/your-service:v1.0.0
```

### Step 3: Store Secrets

```bash
# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name skillancer/dev/your-service \
  --secret-string '{"DATABASE_URL":"...", "API_KEY":"..."}'
```

### Step 4: Define Service in Terraform

```hcl
module "your_service" {
  source = "../../modules/ecs-service"

  # Basic configuration
  project      = var.project
  environment  = var.environment
  service_name = "your-service"

  # Cluster
  cluster_arn  = module.ecs_cluster.cluster_arn
  cluster_name = module.ecs_cluster.cluster_name

  # Network
  vpc_id     = module.networking.vpc_id
  vpc_cidr   = module.networking.vpc_cidr_block
  subnet_ids = module.networking.private_subnet_ids

  # Container
  ecr_repository_url = module.ecr["your-service"].repository_url
  image_tag          = "v1.0.0"
  container_port     = 3000
  cpu                = 256   # 0.25 vCPU
  memory             = 512   # 512 MB

  # IAM
  execution_role_arn = module.ecs_cluster.task_execution_role_arn
  task_role_arn      = module.ecs_cluster.task_role_arn

  # Environment & Secrets
  environment_variables = {
    NODE_ENV  = var.environment
    PORT      = "3000"
    LOG_LEVEL = "info"
  }

  secrets = {
    DATABASE_URL = "${module.secrets.secret_arn}:DATABASE_URL::"
    API_KEY      = "${module.secrets.secret_arn}:API_KEY::"
  }

  # Health Check
  health_check_path = "/health"
  container_health_check = {
    command      = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
    interval     = 30
    timeout      = 5
    retries      = 3
    start_period = 60
  }

  # Load Balancer (for public services)
  alb_security_group_ids = [module.alb.security_group_id]
  alb_listener_arn       = module.alb.https_listener_arn
  alb_priority           = 150
  host_headers           = ["your-service.example.com"]

  # Service Discovery (for internal services)
  enable_service_discovery       = true
  service_discovery_namespace_id = module.ecs_cluster.service_discovery_namespace_id

  # Auto Scaling
  enable_auto_scaling = true
  min_capacity        = 1
  max_capacity        = 5
  cpu_scale_target    = 70
  memory_scale_target = 80

  tags = local.common_tags
}
```

### Step 5: Deploy

```bash
cd infrastructure/terraform/environments/dev
terraform plan
terraform apply
```

## Deployment Strategies

### Rolling Deployment (Default)

- Gradually replaces old tasks with new ones
- Zero downtime
- Best for: Most services, non-critical updates

```hcl
module "service" {
  # ...
  enable_blue_green                  = false  # Uses ECS rolling deployment
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
}
```

### Blue-Green Deployment (Production)

- Creates new environment, switches traffic atomically
- Allows instant rollback
- Best for: Production, critical services

```hcl
module "service" {
  # ...
  enable_blue_green            = true
  codedeploy_role_arn          = module.iam.codedeploy_role_arn
  codedeploy_deployment_config = "CodeDeployDefault.ECSLinear10PercentEvery1Minutes"

  # For testing before cutover
  alb_test_listener_arn        = module.alb.test_listener_arn
  codedeploy_wait_time_for_cutover = 5  # Minutes to wait before switch
  codedeploy_termination_wait_time = 5  # Minutes before killing old tasks
}
```

**Triggering Blue-Green Deployment:**

```bash
# Create appspec.yml
cat > appspec.yml <<EOF
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: "arn:aws:ecs:region:account:task-definition/family:revision"
        LoadBalancerInfo:
          ContainerName: "your-service"
          ContainerPort: 3000
EOF

# Create deployment
aws deploy create-deployment \
  --application-name skillancer-dev-your-service \
  --deployment-group-name skillancer-dev-your-service-dg \
  --revision revisionType=AppSpecContent,content="$(cat appspec.yml)"
```

## Service Discovery

Services can communicate using DNS names in the format:

```
<service-name>.<environment>.skillancer.local
```

**Example:**

```javascript
// In your-service calling auth-service
const authServiceUrl =
  process.env.AUTH_SERVICE_URL || 'http://auth-service.dev.skillancer.local:3000';

const response = await fetch(`${authServiceUrl}/api/verify-token`, {
  method: 'POST',
  body: JSON.stringify({ token }),
});
```

**Terraform Configuration:**

```hcl
module "your_service" {
  # ...
  enable_service_discovery       = true
  service_discovery_namespace_id = module.ecs_cluster.service_discovery_namespace_id

  environment_variables = {
    AUTH_SERVICE_URL   = "http://auth-service.${var.environment}.skillancer.local:3000"
    MARKET_SERVICE_URL = "http://market-service.${var.environment}.skillancer.local:3000"
  }
}
```

## Auto Scaling

### CPU-Based Scaling

```hcl
cpu_scale_target = 70  # Scale when average CPU > 70%
```

### Memory-Based Scaling

```hcl
memory_scale_target = 80  # Scale when average memory > 80%
```

### Request-Based Scaling

```hcl
request_count_scale_target = 1000  # Scale when requests per target > 1000
alb_resource_label = "app/my-alb/abc123/targetgroup/my-tg/def456"
```

### Scaling Behavior

```hcl
min_capacity       = 2      # Minimum tasks
max_capacity       = 20     # Maximum tasks
scale_out_cooldown = 60     # Seconds to wait before scaling out again
scale_in_cooldown  = 300    # Seconds to wait before scaling in again
```

## Monitoring & Debugging

### CloudWatch Logs

```bash
# View logs
aws logs tail /aws/ecs/skillancer-dev/your-service --follow

# Filter logs
aws logs filter-log-events \
  --log-group-name /aws/ecs/skillancer-dev/your-service \
  --filter-pattern "ERROR"
```

### ECS Exec (Debug Container)

```bash
# Enable ECS Exec in service (enabled by default)
enable_execute_command = true

# Connect to running container
aws ecs execute-command \
  --cluster skillancer-dev-cluster \
  --task <task-id> \
  --container your-service \
  --interactive \
  --command "/bin/sh"
```

### CloudWatch Alarms

Services automatically create alarms for:

- **CPU High**: > 85% average CPU
- **Memory High**: > 85% average memory
- **Running Count Low**: Below minimum capacity

```hcl
enable_service_alarms          = true
service_cpu_alarm_threshold    = 85
service_memory_alarm_threshold = 85
alarm_sns_topic_arns           = [module.monitoring.alerts_sns_topic_arn]
```

### Container Insights

Enable for detailed metrics:

```hcl
# In ecs-cluster module
enable_container_insights = true
```

View metrics in CloudWatch:

- Container Insights → ECS Clusters → skillancer-dev-cluster

## Cost Optimization

### Use Fargate Spot for Non-Production

```hcl
# Development/Staging
use_fargate_spot = true  # Up to 70% cost savings
```

### Right-Size Tasks

| Service Type | CPU  | Memory | Use Case            |
| ------------ | ---- | ------ | ------------------- |
| Light API    | 256  | 512    | Simple CRUD APIs    |
| Standard API | 512  | 1024   | Business logic APIs |
| Heavy API    | 1024 | 2048   | Data processing     |
| Worker       | 256  | 512    | Background jobs     |

### Scale Down Off-Hours

```hcl
# Use min_capacity = 0 for non-critical services
min_capacity = var.environment == "dev" ? 0 : 1
```

### Cost Comparison (us-east-1)

| Configuration                  | Hourly | Monthly (730h) |
| ------------------------------ | ------ | -------------- |
| Fargate (256 CPU, 512 MB)      | $0.01  | $7.30          |
| Fargate (512 CPU, 1 GB)        | $0.02  | $14.60         |
| Fargate Spot (256 CPU, 512 MB) | $0.003 | $2.19          |

## Common Operations

### Update Service Image

```bash
# Update image tag in terraform
# variables.tf or tfvars
your_service_image_tag = "v1.1.0"

# Apply
terraform apply -target=module.your_service
```

### Force New Deployment

```bash
aws ecs update-service \
  --cluster skillancer-dev-cluster \
  --service your-service \
  --force-new-deployment
```

### Scale Manually

```bash
# Scale up
aws ecs update-service \
  --cluster skillancer-dev-cluster \
  --service your-service \
  --desired-count 5

# Scale down
aws ecs update-service \
  --cluster skillancer-dev-cluster \
  --service your-service \
  --desired-count 1
```

### Stop Service

```bash
# Scale to 0
aws ecs update-service \
  --cluster skillancer-dev-cluster \
  --service your-service \
  --desired-count 0
```

## Troubleshooting

### Service Won't Start

1. Check task definition: `aws ecs describe-task-definition --task-definition <family>`
2. Check stopped tasks: `aws ecs describe-tasks --cluster <cluster> --tasks <task-id>`
3. Check CloudWatch logs: `/aws/ecs/skillancer-dev/your-service`

### Health Check Failing

1. Verify health check path returns 200
2. Check container logs for startup errors
3. Increase `health_check_grace_period` for slow-starting apps
4. Verify security group allows health check traffic

### Service Discovery Not Working

1. Verify namespace exists: `aws servicediscovery list-namespaces`
2. Check service registration: `aws servicediscovery list-instances --service-id <id>`
3. Test DNS: `dig +short your-service.dev.skillancer.local`
4. Verify VPC DNS settings

### Out of Memory

1. Check container memory limits
2. Review application memory usage
3. Consider increasing task memory
4. Look for memory leaks in application
