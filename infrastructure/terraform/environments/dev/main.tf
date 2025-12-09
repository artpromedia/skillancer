# =============================================================================
# Terraform Configuration - Development Environment
# =============================================================================
# Main configuration file for Skillancer development infrastructure.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# =============================================================================
# Provider Configuration
# =============================================================================

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "skillancer"
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "artpromedia/skillancer"
    }
  }
}

# Provider for us-east-1 (required for CloudFront certificates)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "skillancer"
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "artpromedia/skillancer"
    }
  }
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# =============================================================================
# Local Values
# =============================================================================

locals {
  name_prefix = "skillancer-${var.environment}"
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name

  # Use provided AZs or default to first 3 available
  availability_zones = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, 3)

  common_tags = {
    Project     = "skillancer"
    Environment = var.environment
  }

  # Service definitions for ECS
  services = {
    api-gateway = {
      port          = 3000
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 1
      health_path   = "/health"
      priority      = 100
      host_header   = "api.${var.domain}"
    }
    auth-svc = {
      port          = 3001
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 1
      health_path   = "/health"
      priority      = 110
      host_header   = "auth.${var.domain}"
    }
    market-svc = {
      port          = 3002
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 1
      health_path   = "/health"
      priority      = 120
      host_header   = "market.${var.domain}"
    }
    skillpod-svc = {
      port          = 3003
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 1
      health_path   = "/health"
      priority      = 130
      host_header   = "skillpod.${var.domain}"
    }
    cockpit-svc = {
      port          = 3004
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 1
      health_path   = "/health"
      priority      = 140
      host_header   = "cockpit.${var.domain}"
    }
    billing-svc = {
      port          = 3005
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 1
      health_path   = "/health"
      priority      = 150
      host_header   = "billing.${var.domain}"
    }
    notification-svc = {
      port          = 3006
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 1
      health_path   = "/health"
      priority      = 160
      host_header   = "notifications.${var.domain}"
    }
    audit-svc = {
      port          = 3007
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 1
      health_path   = "/health"
      priority      = 170
      host_header   = "audit.${var.domain}"
    }
  }
}

# =============================================================================
# Networking Module
# =============================================================================

module "networking" {
  source = "../../modules/networking"

  name_prefix        = local.name_prefix
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = local.availability_zones

  # Subnet CIDR configuration
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs

  # NAT Gateway configuration (single NAT for dev to save costs)
  single_nat_gateway = true
  enable_nat_gateway = true

  # VPC Flow Logs
  enable_flow_logs = var.enable_vpc_flow_logs

  tags = local.common_tags
}

# =============================================================================
# ECR Repositories (Reference from Global)
# =============================================================================

data "aws_ecr_repository" "services" {
  for_each = toset(var.service_names)
  name     = each.value
}

# =============================================================================
# ECS Cluster
# =============================================================================

module "ecs_cluster" {
  source = "../../modules/ecs-cluster"

  name_prefix = local.name_prefix
  environment = var.environment

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids

  # Container Insights for monitoring
  enable_container_insights = var.enable_container_insights

  # Capacity providers
  enable_fargate      = true
  enable_fargate_spot = true  # Use spot for dev to reduce costs

  tags = local.common_tags
}

# =============================================================================
# Application Load Balancer
# =============================================================================

module "alb" {
  source = "../../modules/alb"

  name_prefix = local.name_prefix
  environment = var.environment

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.public_subnet_ids

  certificate_arn = var.certificate_arn

  # Access logs (disabled in dev to save costs)
  enable_access_logs = false

  # Deletion protection (disabled in dev for easy cleanup)
  enable_deletion_protection = false

  # HTTPS redirect
  enable_http_to_https_redirect = true

  tags = local.common_tags
}

# =============================================================================
# RDS PostgreSQL
# =============================================================================

module "rds" {
  source = "../../modules/rds"

  name_prefix = local.name_prefix
  environment = var.environment

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.database_subnet_ids

  # Instance configuration
  engine_version        = var.rds_engine_version
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage

  # Database settings
  database_name = "skillancer"
  username      = "skillancer_admin"

  # High availability (disabled in dev)
  multi_az = false

  # Backup configuration
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Performance Insights (free tier available)
  performance_insights_enabled = true

  # Deletion protection (disabled in dev)
  deletion_protection = false
  skip_final_snapshot = true

  # Security
  allowed_security_groups = [module.ecs_cluster.tasks_security_group_id]

  tags = local.common_tags
}

# =============================================================================
# ElastiCache Redis
# =============================================================================

module "elasticache" {
  source = "../../modules/elasticache"

  name_prefix = local.name_prefix
  environment = var.environment

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.database_subnet_ids

  # Cluster configuration
  node_type       = var.redis_node_type
  num_cache_nodes = 1  # Single node for dev
  engine_version  = var.redis_engine_version

  # Cluster mode disabled for simplicity in dev
  cluster_mode_enabled = false

  # Maintenance window
  maintenance_window = "sun:05:00-sun:06:00"

  # Snapshot (minimal for dev)
  snapshot_retention_limit = 1

  # Security
  allowed_security_groups = [module.ecs_cluster.tasks_security_group_id]

  tags = local.common_tags
}

# =============================================================================
# Secrets Manager
# =============================================================================

module "secrets" {
  source = "../../modules/secrets"

  name_prefix = local.name_prefix
  environment = var.environment

  secrets = {
    database_url = {
      description = "PostgreSQL connection string"
      # Value will be set after RDS is created
    }
    redis_url = {
      description = "Redis connection string"
      # Value will be set after ElastiCache is created
    }
    jwt_secret = {
      description = "JWT signing secret"
      generate    = true
      length      = 64
    }
    jwt_refresh_secret = {
      description = "JWT refresh token secret"
      generate    = true
      length      = 64
    }
    stripe_secret_key = {
      description = "Stripe API secret key"
    }
    stripe_webhook_secret = {
      description = "Stripe webhook signing secret"
    }
    sendgrid_api_key = {
      description = "SendGrid API key for email"
    }
    aws_ses_smtp_password = {
      description = "AWS SES SMTP password"
    }
  }

  # Recovery window (shorter for dev)
  recovery_window_in_days = 7

  tags = local.common_tags
}

# =============================================================================
# IAM Roles
# =============================================================================

module "iam" {
  source = "../../modules/iam"

  name_prefix = local.name_prefix
  environment = var.environment

  # ECS task execution role
  create_ecs_execution_role = true
  ecs_execution_role_name   = "${local.name_prefix}-ecs-execution"

  # ECS task role
  create_ecs_task_role = true
  ecs_task_role_name   = "${local.name_prefix}-ecs-task"

  # Secrets ARNs for task role
  secrets_arns = values(module.secrets.secret_arns)

  # S3 buckets for task role (if any)
  s3_bucket_arns = []

  tags = local.common_tags
}

# =============================================================================
# ECS Services
# =============================================================================

module "ecs_services" {
  source   = "../../modules/ecs-service"
  for_each = local.services

  name_prefix  = local.name_prefix
  service_name = each.key
  environment  = var.environment

  # ECS Configuration
  cluster_id   = module.ecs_cluster.cluster_id
  cluster_name = module.ecs_cluster.cluster_name

  # Network Configuration
  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids

  # Container Configuration
  container_image = "${data.aws_ecr_repository.services[each.key].repository_url}:${var.container_image_tag}"
  container_port  = each.value.port
  cpu             = each.value.cpu
  memory          = each.value.memory
  desired_count   = each.value.desired_count

  # Load Balancer Configuration
  alb_listener_arn  = module.alb.https_listener_arn
  alb_priority      = each.value.priority
  host_header       = each.value.host_header
  health_check_path = each.value.health_path

  # IAM Roles
  execution_role_arn = module.iam.ecs_execution_role_arn
  task_role_arn      = module.iam.ecs_task_role_arn

  # Security Groups
  alb_security_group_id = module.alb.security_group_id

  # Environment Variables
  environment_variables = {
    NODE_ENV    = var.environment
    LOG_LEVEL   = "debug"
    PORT        = tostring(each.value.port)
    AWS_REGION  = var.aws_region
    SERVICE_NAME = each.key
  }

  # Secrets (from Secrets Manager)
  secrets = {
    DATABASE_URL       = module.secrets.secret_arns["database_url"]
    REDIS_URL          = module.secrets.secret_arns["redis_url"]
    JWT_SECRET         = module.secrets.secret_arns["jwt_secret"]
    JWT_REFRESH_SECRET = module.secrets.secret_arns["jwt_refresh_secret"]
  }

  # Capacity provider strategy (use Fargate Spot for dev)
  capacity_provider_strategy = [
    {
      capacity_provider = "FARGATE_SPOT"
      weight            = 100
      base              = 0
    }
  ]

  tags = local.common_tags

  depends_on = [
    module.ecs_cluster,
    module.alb,
    module.secrets
  ]
}

# =============================================================================
# CloudWatch Monitoring
# =============================================================================

module "monitoring" {
  source = "../../modules/monitoring"

  name_prefix = local.name_prefix
  environment = var.environment

  # ECS monitoring
  ecs_cluster_name = module.ecs_cluster.cluster_name
  ecs_service_names = keys(local.services)

  # RDS monitoring
  rds_instance_id = module.rds.instance_id

  # ElastiCache monitoring
  elasticache_cluster_id = module.elasticache.cluster_id

  # ALB monitoring
  alb_arn_suffix = module.alb.arn_suffix

  # Alert configuration
  alert_email = var.alert_email

  # Create dashboard
  create_dashboard = true

  # Alarm thresholds (relaxed for dev)
  cpu_alarm_threshold    = 90
  memory_alarm_threshold = 90
  error_rate_threshold   = 10

  tags = local.common_tags
}
