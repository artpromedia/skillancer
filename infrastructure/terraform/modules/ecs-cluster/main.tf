# =============================================================================
# ECS Cluster Module
# Creates ECS Fargate cluster with capacity providers, IAM roles, and service discovery
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.project}-${var.environment}"
  
  common_tags = merge(var.tags, {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "ecs-cluster"
  })
}

# -----------------------------------------------------------------------------
# ECS Cluster
# -----------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = var.kms_key_arn != null
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cluster"
  })
}

# -----------------------------------------------------------------------------
# ECS Cluster Capacity Providers
# -----------------------------------------------------------------------------

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  # Production: Mix of on-demand and spot for reliability with cost optimization
  # Non-production: Primarily spot for maximum cost savings
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = var.environment == "prod" ? var.fargate_base_weight : 0
    base              = var.environment == "prod" ? 1 : 0
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = var.environment == "prod" ? var.fargate_spot_weight : 100
    base              = 0
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group for ECS Exec
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/aws/ecs/${local.name_prefix}/exec"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-exec-logs"
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group for ECS Services
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "ecs_services" {
  name              = "/aws/ecs/${local.name_prefix}/services"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-services-logs"
  })
}

# -----------------------------------------------------------------------------
# Service Discovery Namespace
# -----------------------------------------------------------------------------

resource "aws_service_discovery_private_dns_namespace" "main" {
  count = var.enable_service_discovery ? 1 : 0

  name        = "${var.environment}.skillancer.local"
  description = "Service discovery namespace for ${local.name_prefix}"
  vpc         = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-service-discovery"
  })
}

# -----------------------------------------------------------------------------
# Task Execution Role (used by ECS agent to pull images, get secrets)
# -----------------------------------------------------------------------------

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-task-execution"
  })
}

# Attach AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom policy for Secrets Manager access
resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${local.name_prefix}-ecs-task-execution-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${local.name_prefix}/*",
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:skillancer/${var.environment}/*"
        ]
      },
      {
        Sid    = "GetParameters"
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${local.name_prefix}/*",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/skillancer/${var.environment}/*"
        ]
      },
      {
        Sid    = "DecryptSecrets"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.kms_key_arn != null ? [var.kms_key_arn] : ["*"]
        Condition = {
          StringEquals = {
            "kms:ViaService" = [
              "secretsmanager.${data.aws_region.current.name}.amazonaws.com",
              "ssm.${data.aws_region.current.name}.amazonaws.com"
            ]
          }
        }
      }
    ]
  })
}

# Custom policy for ECR access
resource "aws_iam_role_policy" "ecs_task_execution_ecr" {
  name = "${local.name_prefix}-ecs-task-execution-ecr"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = [
          "arn:aws:ecr:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:repository/skillancer/*"
        ]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Default Task Role (used by the application running in containers)
# -----------------------------------------------------------------------------

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-task"
  })
}

# Policy for ECS Exec (debugging)
resource "aws_iam_role_policy" "ecs_task_exec" {
  name = "${local.name_prefix}-ecs-task-exec"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECSExec"
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECSExecLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.ecs_exec.arn}:*"
      }
    ]
  })
}

# Policy for X-Ray tracing
resource "aws_iam_role_policy" "ecs_task_xray" {
  count = var.enable_xray ? 1 : 0

  name = "${local.name_prefix}-ecs-task-xray"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "XRay"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries"
        ]
        Resource = "*"
      }
    ]
  })
}

# Policy for CloudWatch metrics
resource "aws_iam_role_policy" "ecs_task_cloudwatch" {
  name = "${local.name_prefix}-ecs-task-cloudwatch"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = [
              "Skillancer/${var.environment}",
              "ECS/ContainerInsights"
            ]
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Cluster Monitoring
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "cluster_cpu_high" {
  count = var.enable_cluster_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-cluster-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cluster_cpu_alarm_threshold
  alarm_description   = "ECS cluster CPU utilization is too high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }

  alarm_actions = var.alarm_sns_topic_arns
  ok_actions    = var.alarm_sns_topic_arns

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "cluster_memory_high" {
  count = var.enable_cluster_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-cluster-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cluster_memory_alarm_threshold
  alarm_description   = "ECS cluster memory utilization is too high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }

  alarm_actions = var.alarm_sns_topic_arns
  ok_actions    = var.alarm_sns_topic_arns

  tags = local.common_tags
}
