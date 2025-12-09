# =============================================================================
# Terraform Configuration - Staging Environment
# =============================================================================
# Staging environment configuration with production-like settings
# but reduced capacity for cost optimization.
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
  name_prefix        = "skillancer-${var.environment}"
  account_id         = data.aws_caller_identity.current.account_id
  region             = data.aws_region.current.name
  availability_zones = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, 3)

  common_tags = {
    Project     = "skillancer"
    Environment = var.environment
  }

  # Service definitions - staging has 2 instances per service
  services = {
    api-gateway = {
      port          = 3000
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 2
      health_path   = "/health"
      priority      = 100
      host_header   = "api.${var.domain}"
    }
    auth-svc = {
      port          = 3001
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 2
      health_path   = "/health"
      priority      = 110
      host_header   = "auth.${var.domain}"
    }
    market-svc = {
      port          = 3002
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 2
      health_path   = "/health"
      priority      = 120
      host_header   = "market.${var.domain}"
    }
    skillpod-svc = {
      port          = 3003
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 2
      health_path   = "/health"
      priority      = 130
      host_header   = "skillpod.${var.domain}"
    }
    cockpit-svc = {
      port          = 3004
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 2
      health_path   = "/health"
      priority      = 140
      host_header   = "cockpit.${var.domain}"
    }
    billing-svc = {
      port          = 3005
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 2
      health_path   = "/health"
      priority      = 150
      host_header   = "billing.${var.domain}"
    }
    notification-svc = {
      port          = 3006
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 2
      health_path   = "/health"
      priority      = 160
      host_header   = "notifications.${var.domain}"
    }
    audit-svc = {
      port          = 3007
      cpu           = var.service_cpu
      memory        = var.service_memory
      desired_count = 2
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

  # Multi-AZ NAT for staging (production-like)
  single_nat_gateway = false
  enable_nat_gateway = true

  # VPC Flow Logs enabled
  enable_flow_logs = true

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

  # Mixed capacity providers for cost optimization
  enable_fargate      = true
  enable_fargate_spot = true

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

  # Access logs enabled for staging
  enable_access_logs = true
  access_logs_bucket = var.alb_access_logs_bucket

  # Deletion protection enabled
  enable_deletion_protection = true

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

  engine_version        = var.rds_engine_version
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage

  database_name = "skillancer"
  username      = "skillancer_admin"

  # Multi-AZ disabled for staging (cost savings)
  multi_az = false

  # Enhanced backup for staging
  backup_retention_period = 14
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Deletion protection enabled
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${local.name_prefix}-final-snapshot"

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
  num_cache_nodes = 2  # Two nodes for staging
  engine_version  = var.redis_engine_version

  # Replication for staging
  cluster_mode_enabled  = false
  automatic_failover    = true

  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_retention_limit = 7

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
    redis_url = {
      description = "Redis connection string"
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
      description = "SendGrid API key"
    }
    aws_ses_smtp_password = {
      description = "AWS SES SMTP password"
    }
  }

  recovery_window_in_days = 14

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
    LOG_LEVEL    = "info"
    PORT         = tostring(each.value.port)
    AWS_REGION   = var.aws_region
    SERVICE_NAME = each.key
  }

  secrets = {
    DATABASE_URL       = module.secrets.secret_arns["database_url"]
    REDIS_URL          = module.secrets.secret_arns["redis_url"]
    JWT_SECRET         = module.secrets.secret_arns["jwt_secret"]
    JWT_REFRESH_SECRET = module.secrets.secret_arns["jwt_refresh_secret"]
  }

  # Mix of Fargate and Fargate Spot for staging
  capacity_provider_strategy = [
    {
      capacity_provider = "FARGATE"
      weight            = 50
      base              = 1
    },
    {
      capacity_provider = "FARGATE_SPOT"
      weight            = 50
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

  ecs_cluster_name  = module.ecs_cluster.cluster_name
  ecs_service_names = keys(local.services)

  rds_instance_id = module.rds.instance_id

  elasticache_cluster_id = module.elasticache.cluster_id

  alb_arn_suffix = module.alb.arn_suffix

  alert_email = var.alert_email

  create_dashboard = true

  # Tighter thresholds for staging
  cpu_alarm_threshold    = 80
  memory_alarm_threshold = 80
  error_rate_threshold   = 5

  tags = local.common_tags
}
