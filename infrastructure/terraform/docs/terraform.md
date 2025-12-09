# Terraform Infrastructure Documentation

This document provides a comprehensive guide to the Skillancer Terraform infrastructure setup, including architecture overview, module descriptions, and operational procedures.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Getting Started](#getting-started)
4. [Environments](#environments)
5. [Modules](#modules)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Operations](#operations)
8. [Security](#security)
9. [Cost Management](#cost-management)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The Skillancer infrastructure is deployed across three environments (dev, staging, prod) using AWS services:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         VPC (10.x.0.0/16)                              │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │  │
│  │  │  Public Subnet  │  │  Public Subnet  │  │  Public Subnet      │   │  │
│  │  │   (AZ-a)        │  │   (AZ-b)        │  │   (AZ-c)            │   │  │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────────┐  │   │  │
│  │  │  │    ALB    │  │  │  │  NAT GW   │  │  │  │    NAT GW     │  │   │  │
│  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────────┘  │   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │  │
│  │  │ Private Subnet  │  │ Private Subnet  │  │  Private Subnet     │   │  │
│  │  │   (AZ-a)        │  │   (AZ-b)        │  │   (AZ-c)            │   │  │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────────┐  │   │  │
│  │  │  │ ECS Tasks │  │  │  │ ECS Tasks │  │  │  │  ECS Tasks    │  │   │  │
│  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────────┘  │   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │  │
│  │  │ Database Subnet │  │ Database Subnet │  │  Database Subnet    │   │  │
│  │  │   (AZ-a)        │  │   (AZ-b)        │  │   (AZ-c)            │   │  │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────────┐  │   │  │
│  │  │  │    RDS    │  │  │  │   Redis   │  │  │  │  RDS Replica  │  │   │  │
│  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────────┘  │   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AWS Services Used

| Service           | Purpose                            |
| ----------------- | ---------------------------------- |
| VPC               | Network isolation and security     |
| ECS Fargate       | Container orchestration            |
| RDS PostgreSQL    | Primary database                   |
| ElastiCache Redis | Caching and session storage        |
| ALB               | Load balancing and SSL termination |
| ECR               | Container image registry           |
| Secrets Manager   | Secure credential storage          |
| CloudWatch        | Monitoring and logging             |
| S3                | Terraform state and assets         |
| DynamoDB          | Terraform state locking            |

---

## Directory Structure

```
infrastructure/terraform/
├── environments/
│   ├── dev/
│   │   ├── backend.tf          # S3 backend configuration
│   │   ├── main.tf             # Module compositions
│   │   ├── variables.tf        # Variable definitions
│   │   ├── outputs.tf          # Output definitions
│   │   └── terraform.tfvars    # Environment-specific values
│   ├── staging/
│   │   └── ... (same structure)
│   └── prod/
│       └── ... (same structure)
├── modules/
│   ├── networking/             # VPC, subnets, NAT, routes
│   ├── ecs-cluster/            # ECS cluster and capacity providers
│   ├── ecs-service/            # ECS service definitions
│   ├── rds/                    # PostgreSQL database
│   ├── elasticache/            # Redis cluster
│   ├── alb/                    # Application Load Balancer
│   ├── ecr/                    # Container registry
│   ├── iam/                    # IAM roles and policies
│   ├── secrets/                # Secrets Manager
│   └── monitoring/             # CloudWatch and alarms
├── scripts/
│   ├── init-backend.sh         # Initialize S3 backend
│   └── plan-apply.sh           # Safe plan/apply wrapper
└── docs/
    └── terraform.md            # This documentation
```

---

## Getting Started

### Prerequisites

- Terraform >= 1.5.0
- AWS CLI v2 configured with appropriate credentials
- Access to AWS accounts for dev, staging, and prod

### Initial Setup

1. **Initialize the S3 Backend** (first time only):

```bash
cd infrastructure/terraform/scripts
chmod +x init-backend.sh
./init-backend.sh dev  # or staging, prod
```

2. **Initialize Terraform**:

```bash
cd infrastructure/terraform/environments/dev
terraform init
```

3. **Plan Changes**:

```bash
terraform plan -var-file=terraform.tfvars
```

4. **Apply Changes**:

```bash
terraform apply -var-file=terraform.tfvars
```

### Using the Helper Script

```bash
cd infrastructure/terraform/scripts

# Plan for dev
./plan-apply.sh plan dev

# Apply to staging
./plan-apply.sh apply staging

# Destroy dev (with confirmation)
./plan-apply.sh destroy dev
```

---

## Environments

### Development (dev)

- **Purpose**: Development and testing
- **VPC CIDR**: 10.0.0.0/16
- **Resources**: Minimal sizing, single NAT gateway
- **Features**: Fargate Spot enabled, single-AZ database

### Staging (staging)

- **Purpose**: Pre-production testing
- **VPC CIDR**: 10.1.0.0/16
- **Resources**: Moderate sizing
- **Features**: Multi-AZ enabled, auto-scaling

### Production (prod)

- **Purpose**: Live production environment
- **VPC CIDR**: 10.2.0.0/16
- **Resources**: Production-grade sizing
- **Features**: Multi-AZ, read replicas, high availability

### Resource Sizing by Environment

| Resource      | Dev            | Staging        | Prod            |
| ------------- | -------------- | -------------- | --------------- |
| ECS CPU       | 256            | 512            | 1024            |
| ECS Memory    | 512 MB         | 1 GB           | 2 GB            |
| RDS Instance  | db.t3.micro    | db.t3.small    | db.r6g.large    |
| Redis Node    | cache.t3.micro | cache.t3.small | cache.r6g.large |
| Desired Count | 1              | 2              | 3               |
| Read Replicas | 0              | 0              | 2               |

---

## Modules

### networking

Creates VPC infrastructure including subnets, NAT gateways, and route tables.

```hcl
module "networking" {
  source = "../../modules/networking"

  project               = "skillancer"
  environment           = "dev"
  aws_region            = "us-east-1"
  vpc_cidr              = "10.0.0.0/16"
  public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs  = ["10.0.11.0/24", "10.0.12.0/24"]
  database_subnet_cidrs = ["10.0.21.0/24", "10.0.22.0/24"]
  enable_nat_gateway    = true
  single_nat_gateway    = true  # Use false for prod
}
```

### ecs-cluster

Creates ECS Fargate cluster with optional service discovery.

```hcl
module "ecs_cluster" {
  source = "../../modules/ecs-cluster"

  project                   = "skillancer"
  environment               = "dev"
  vpc_id                    = module.networking.vpc_id
  enable_container_insights = true
  use_fargate_spot          = true  # Cost savings for dev
}
```

### ecs-service

Creates individual ECS services with auto-scaling.

```hcl
module "ecs_service" {
  source = "../../modules/ecs-service"

  project            = "skillancer"
  environment        = "dev"
  service_name       = "api-gateway"
  cluster_arn        = module.ecs_cluster.cluster_arn
  cluster_name       = module.ecs_cluster.cluster_name
  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.private_subnet_ids
  ecr_repository_url = module.ecr.repository_url
  cpu                = 256
  memory             = 512
  desired_count      = 1
  enable_auto_scaling = false
}
```

### rds

Creates PostgreSQL database with optional read replicas.

```hcl
module "rds" {
  source = "../../modules/rds"

  project                   = "skillancer"
  environment               = "dev"
  vpc_id                    = module.networking.vpc_id
  subnet_ids                = module.networking.database_subnet_ids
  allowed_security_group_ids = [module.ecs_cluster.security_group_id]
  engine_version            = "16.1"
  instance_class            = "db.t3.micro"
  allocated_storage         = 20
  multi_az                  = false
  create_read_replica       = false
}
```

### elasticache

Creates Redis cluster with encryption.

```hcl
module "elasticache" {
  source = "../../modules/elasticache"

  project                    = "skillancer"
  environment                = "dev"
  vpc_id                     = module.networking.vpc_id
  subnet_ids                 = module.networking.database_subnet_ids
  allowed_security_group_ids = [module.ecs_cluster.security_group_id]
  engine_version             = "7.0"
  node_type                  = "cache.t3.micro"
  num_cache_clusters         = 1
  transit_encryption_enabled = true
}
```

---

## CI/CD Pipeline

The Terraform CI/CD pipeline is defined in `.github/workflows/terraform.yml`.

### Workflow Triggers

| Event           | Action                                |
| --------------- | ------------------------------------- |
| PR to main      | Plan only (per environment)           |
| Push to main    | Plan and Apply (dev → staging → prod) |
| Manual dispatch | Plan or Apply specific environment    |

### Workflow Features

1. **Change Detection**: Only runs for affected environments
2. **Format Check**: Ensures consistent formatting
3. **Security Scan**: tfsec and Checkov analysis
4. **Cost Estimation**: Infracost analysis on PRs
5. **Environment Protection**: Manual approval for prod
6. **Slack Notifications**: Alerts on prod deployments

### Required Secrets

Configure these in GitHub repository settings:

| Secret                 | Description                      |
| ---------------------- | -------------------------------- |
| `AWS_ROLE_ARN_DEV`     | IAM role ARN for dev account     |
| `AWS_ROLE_ARN_STAGING` | IAM role ARN for staging account |
| `AWS_ROLE_ARN_PROD`    | IAM role ARN for prod account    |
| `SLACK_WEBHOOK_URL`    | Slack webhook for notifications  |
| `INFRACOST_API_KEY`    | Infracost API key (optional)     |

### GitHub Environments

Create these environments in GitHub settings:

- `dev` - No protection rules
- `staging` - No protection rules
- `prod-plan` - No protection rules (for planning)
- `prod` - Required reviewers, deployment branches

---

## Operations

### Accessing Resources

#### ECS Exec (Container Shell Access)

```bash
aws ecs execute-command \
  --cluster skillancer-dev \
  --task <task-id> \
  --container <service-name> \
  --interactive \
  --command "/bin/sh"
```

#### Database Connection

Retrieve credentials from Secrets Manager:

```bash
aws secretsmanager get-secret-value \
  --secret-id skillancer/dev/rds/credentials \
  --query SecretString --output text | jq
```

### Scaling

#### Manual ECS Scaling

```bash
aws ecs update-service \
  --cluster skillancer-dev \
  --service skillancer-dev-api-gateway \
  --desired-count 3
```

#### Auto-scaling is configured via Terraform

```hcl
enable_auto_scaling = true
min_capacity        = 1
max_capacity        = 10
cpu_scale_target    = 70
memory_scale_target = 80
```

### Backup and Recovery

#### RDS Snapshots

- Automated daily backups (retention: 7 days dev, 30 days prod)
- Manual snapshots before major changes

```bash
aws rds create-db-snapshot \
  --db-instance-identifier skillancer-dev \
  --db-snapshot-identifier pre-migration-snapshot
```

#### Point-in-Time Recovery

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier skillancer-prod \
  --target-db-instance-identifier skillancer-prod-restored \
  --restore-time "2024-01-15T10:00:00Z"
```

---

## Security

### Network Security

- VPC with public, private, and database subnets
- NAT gateways for outbound internet access
- Security groups restricting inter-service communication
- VPC Flow Logs enabled

### Data Encryption

- RDS: Encryption at rest (AWS KMS)
- ElastiCache: Encryption at rest and in transit
- S3: Default encryption enabled
- Secrets Manager: AWS KMS encryption

### Access Control

- IAM roles with least-privilege permissions
- ECS task roles separate from execution roles
- GitHub Actions OIDC for keyless authentication

### Secret Management

All sensitive values stored in AWS Secrets Manager:

- Database credentials
- API keys
- JWT secrets
- Third-party integration tokens

---

## Cost Management

### Cost Optimization Strategies

1. **Fargate Spot**: Used in dev/staging for 70% cost savings
2. **Single NAT Gateway**: Dev uses single NAT vs. per-AZ
3. **Right-sizing**: Environment-appropriate instance sizes
4. **Auto-scaling**: Scale down during low-traffic periods

### Estimated Monthly Costs

| Environment | Estimated Cost |
| ----------- | -------------- |
| Dev         | ~$150-200      |
| Staging     | ~$300-400      |
| Prod        | ~$800-1200     |

### Cost Monitoring

- Infracost integration in PRs
- AWS Cost Explorer tags by environment
- CloudWatch billing alarms

---

## Troubleshooting

### Common Issues

#### Terraform State Lock

```bash
# Force unlock (use with caution)
terraform force-unlock <lock-id>
```

#### ECS Service Not Starting

1. Check CloudWatch logs: `/ecs/skillancer-{env}/services`
2. Verify security group rules
3. Check task definition resource limits
4. Verify secrets access

#### Database Connection Issues

1. Verify security group allows ECS → RDS
2. Check Secrets Manager permissions
3. Validate database credentials
4. Check RDS instance status

### Useful Commands

```bash
# List all resources in state
terraform state list

# Show specific resource
terraform state show module.rds.aws_db_instance.main

# Refresh state
terraform refresh

# Import existing resource
terraform import module.rds.aws_db_instance.main skillancer-dev

# Taint resource for recreation
terraform taint module.ecs_services["api-gateway"].aws_ecs_service.main
```

### Getting Help

1. Check CloudWatch Logs for application errors
2. Review CloudWatch Alarms for infrastructure issues
3. Check AWS Health Dashboard for service issues
4. Contact DevOps team via Slack #infrastructure

---

## References

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/)
