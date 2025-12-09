# =============================================================================
# Terraform Configuration - Production Environment
# =============================================================================
# Production environment with full high-availability configuration,
# multi-AZ deployments, and comprehensive monitoring.
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
      CostCenter  = "production"
    }
  }
}

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

# Secondary region provider for disaster recovery
provider "aws" {
  alias  = "eu_west_1"
  region = "eu-west-1"

  default_tags {
    tags = {
      Project     = "skillancer"
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "artpromedia/skillancer"
      Purpose     = "disaster-recovery"
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
  name_prefix        = "skillancer-${var.environment}"
  account_id         = data.aws_caller_identity.current.account_id
  region             = data.aws_region.current.name
  availability_zones = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, 3)

  common_tags = {
    Project     = "skillancer"
    Environment = var.environment
    CostCenter  = "production"
  }

  # Service definitions - production has 3+ instances with autoscaling
  services = {
    api-gateway = {
      port          = 3000
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 3
      min_count     = 3
      max_count     = 10
      health_path   = "/health"
      priority      = 100
      host_header   = "api.${var.domain}"
    }
    auth-svc = {
      port          = 3001
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 3
      min_count     = 3
      max_count     = 8
      health_path   = "/health"
      priority      = 110
      host_header   = "auth.${var.domain}"
    }
    market-svc = {
      port          = 3002
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 3
      min_count     = 3
      max_count     = 10
      health_path   = "/health"
      priority      = 120
      host_header   = "market.${var.domain}"
    }
    skillpod-svc = {
      port          = 3003
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 3
      min_count     = 3
      max_count     = 8
      health_path   = "/health"
      priority      = 130
      host_header   = "skillpod.${var.domain}"
    }
    cockpit-svc = {
      port          = 3004
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 3
      min_count     = 3
      max_count     = 8
      health_path   = "/health"
      priority      = 140
      host_header   = "cockpit.${var.domain}"
    }
    billing-svc = {
      port          = 3005
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 3
      min_count     = 2
      max_count     = 6
      health_path   = "/health"
      priority      = 150
      host_header   = "billing.${var.domain}"
    }
    notification-svc = {
      port          = 3006
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 3
      min_count     = 2
      max_count     = 8
      health_path   = "/health"
      priority      = 160
      host_header   = "notifications.${var.domain}"
    }
    audit-svc = {
      port          = 3007
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 2
      min_count     = 2
      max_count     = 4
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

  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs

  # Multi-AZ NAT for high availability
  single_nat_gateway = false
  enable_nat_gateway = true

  # VPC Flow Logs enabled with extended retention
  enable_flow_logs      = true
  flow_logs_retention   = 90

  # VPC Endpoints for AWS services (reduce NAT costs and improve security)
  enable_vpc_endpoints = true

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

  enable_container_insights = true

  # Fargate only for production stability
  enable_fargate      = true
  enable_fargate_spot = false  # No spot in production for reliability

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

  # Access logs enabled
  enable_access_logs = true
  access_logs_bucket = var.alb_access_logs_bucket

  # Deletion protection enabled
  enable_deletion_protection = true

  enable_http_to_https_redirect = true

  # WAF integration
  enable_waf = true

  # Cross-zone load balancing
  enable_cross_zone_load_balancing = true

  # Idle timeout
  idle_timeout = 60

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

  engine_version        = var.rds_engine_version
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage

  database_name = "skillancer"
  username      = "skillancer_admin"

  # Multi-AZ enabled for production
  multi_az = true

  # Enhanced backup configuration
  backup_retention_period = 35
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:00-Sun:05:00"

  # Performance Insights with extended retention
  performance_insights_enabled          = true
  performance_insights_retention_period = 31

  # Enhanced monitoring
  monitoring_interval = 30

  # Deletion protection enabled
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-final-snapshot"

  # Storage encryption
  storage_encrypted = true
  kms_key_id        = var.rds_kms_key_id

  # Read replicas
  create_read_replica    = var.create_rds_read_replica
  read_replica_count     = var.rds_read_replica_count

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

  node_type       = var.redis_node_type
  num_cache_nodes = 3  # Three nodes for production
  engine_version  = var.redis_engine_version

  # Cluster mode for high availability
  cluster_mode_enabled   = true
  automatic_failover     = true
  multi_az_enabled       = true

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled         = true

  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_retention_limit = 14
  snapshot_window          = "04:00-05:00"

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
    }
    database_url_readonly = {
      description = "PostgreSQL read replica connection string"
    }
    redis_url = {
      description = "Redis connection string"
    }
    redis_auth_token = {
      description = "Redis auth token"
      generate    = true
      length      = 64
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
      description = "Stripe API secret key (production)"
    }
    stripe_webhook_secret = {
      description = "Stripe webhook signing secret"
    }
    sendgrid_api_key = {
      description = "SendGrid API key"
    }
    aws_ses_smtp_password = {
      description = "AWS SES SMTP password"
    }
    datadog_api_key = {
      description = "Datadog API key for monitoring"
    }
  }

  # Extended recovery window for production
  recovery_window_in_days = 30

  # Enable automatic rotation
  enable_rotation = true

  tags = local.common_tags
}

# =============================================================================
# IAM Roles
# =============================================================================

module "iam" {
  source = "../../modules/iam"

  name_prefix = local.name_prefix
  environment = var.environment

  create_ecs_execution_role = true
  ecs_execution_role_name   = "${local.name_prefix}-ecs-execution"

  create_ecs_task_role = true
  ecs_task_role_name   = "${local.name_prefix}-ecs-task"

  secrets_arns   = values(module.secrets.secret_arns)
  s3_bucket_arns = var.s3_bucket_arns

  # Additional permissions for production
  enable_xray_tracing    = true
  enable_ssm_parameters  = true

  tags = local.common_tags
}

# =============================================================================
# ECS Services with Autoscaling
# =============================================================================

module "ecs_services" {
  source   = "../../modules/ecs-service"
  for_each = local.services

  name_prefix  = local.name_prefix
  service_name = each.key
  environment  = var.environment

  cluster_id   = module.ecs_cluster.cluster_id
  cluster_name = module.ecs_cluster.cluster_name

  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids

  container_image = "${data.aws_ecr_repository.services[each.key].repository_url}:${var.container_image_tag}"
  container_port  = each.value.port
  cpu             = each.value.cpu
  memory          = each.value.memory
  desired_count   = each.value.desired_count

  alb_listener_arn  = module.alb.https_listener_arn
  alb_priority      = each.value.priority
  host_header       = each.value.host_header
  health_check_path = each.value.health_path

  execution_role_arn = module.iam.ecs_execution_role_arn
  task_role_arn      = module.iam.ecs_task_role_arn

  alb_security_group_id = module.alb.security_group_id

  environment_variables = {
    NODE_ENV     = var.environment
    LOG_LEVEL    = "warn"
    PORT         = tostring(each.value.port)
    AWS_REGION   = var.aws_region
    SERVICE_NAME = each.key
    TRACING_ENABLED = "true"
  }

  secrets = {
    DATABASE_URL          = module.secrets.secret_arns["database_url"]
    DATABASE_URL_READONLY = module.secrets.secret_arns["database_url_readonly"]
    REDIS_URL             = module.secrets.secret_arns["redis_url"]
    REDIS_AUTH_TOKEN      = module.secrets.secret_arns["redis_auth_token"]
    JWT_SECRET            = module.secrets.secret_arns["jwt_secret"]
    JWT_REFRESH_SECRET    = module.secrets.secret_arns["jwt_refresh_secret"]
  }

  # Fargate only for production
  capacity_provider_strategy = [
    {
      capacity_provider = "FARGATE"
      weight            = 100
      base              = each.value.min_count
    }
  ]

  # Autoscaling configuration
  enable_autoscaling = true
  autoscaling_min    = each.value.min_count
  autoscaling_max    = each.value.max_count
  cpu_target_value   = 70
  memory_target_value = 80

  # Deployment configuration for zero-downtime
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # Circuit breaker
  enable_circuit_breaker = true

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

  ecs_cluster_name  = module.ecs_cluster.cluster_name
  ecs_service_names = keys(local.services)

  rds_instance_id = module.rds.instance_id

  elasticache_cluster_id = module.elasticache.cluster_id

  alb_arn_suffix = module.alb.arn_suffix

  # Multiple alert channels for production
  alert_email      = var.alert_email
  alert_slack_url  = var.alert_slack_webhook
  alert_pagerduty  = var.pagerduty_service_key

  create_dashboard = true

  # Tight thresholds for production
  cpu_alarm_threshold    = 70
  memory_alarm_threshold = 75
  error_rate_threshold   = 1
  latency_threshold_ms   = 500

  # Extended metrics retention
  metrics_retention_days = 90

  # Create composite alarms
  create_composite_alarms = true

  tags = local.common_tags
}

# =============================================================================
# AWS Backup (Production Only)
# =============================================================================

module "backup" {
  source = "../../modules/backup"

  name_prefix = local.name_prefix
  environment = var.environment

  # RDS backup
  rds_arn = module.rds.arn

  # Backup schedule (daily at 2 AM UTC)
  schedule_expression = "cron(0 2 * * ? *)"

  # Retention periods
  delete_after_days   = 35
  move_to_cold_after  = 90
  delete_cold_after   = 365

  # Cross-region backup
  enable_cross_region_backup = true
  cross_region               = "eu-west-1"

  tags = local.common_tags
}
