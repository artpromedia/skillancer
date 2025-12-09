# =============================================================================
# ECS Cluster Module
# Creates ECS Fargate cluster with capacity providers
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
# ECS Cluster
# -----------------------------------------------------------------------------

resource "aws_ecs_cluster" "main" {
  name = "${var.project}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  tags = {
    Name = "${var.project}-${var.environment}-cluster"
  }
}

# -----------------------------------------------------------------------------
# ECS Cluster Capacity Providers
# -----------------------------------------------------------------------------

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = var.use_fargate_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = var.use_fargate_spot ? 70 : 100
    base              = var.use_fargate_spot ? 1 : 0
  }

  dynamic "default_capacity_provider_strategy" {
    for_each = var.use_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE"
      weight            = 30
      base              = 1
    }
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group for ECS Exec
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/ecs/${var.project}-${var.environment}/exec"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project}-${var.environment}-ecs-exec-logs"
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group for ECS Services
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "ecs_services" {
  name              = "/ecs/${var.project}-${var.environment}/services"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project}-${var.environment}-ecs-services-logs"
  }
}

# -----------------------------------------------------------------------------
# Service Discovery Namespace
# -----------------------------------------------------------------------------

resource "aws_service_discovery_private_dns_namespace" "main" {
  count = var.enable_service_discovery ? 1 : 0

  name        = "${var.environment}.${var.project}.local"
  description = "Service discovery namespace for ${var.project} ${var.environment}"
  vpc         = var.vpc_id

  tags = {
    Name = "${var.project}-${var.environment}-namespace"
  }
}
