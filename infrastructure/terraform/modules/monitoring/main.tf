# =============================================================================
# Monitoring Module
# Creates CloudWatch dashboards, alarms, and SNS topics
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
# CloudWatch Log Group
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "main" {
  name              = "/ecs/${var.project}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project}-${var.environment}-logs"
  }
}

# -----------------------------------------------------------------------------
# SNS Topics
# -----------------------------------------------------------------------------

resource "aws_sns_topic" "alerts" {
  name = "${var.project}-${var.environment}-alerts"

  tags = {
    Name = "${var.project}-${var.environment}-alerts"
  }
}

resource "aws_sns_topic" "critical" {
  name = "${var.project}-${var.environment}-critical"

  tags = {
    Name = "${var.project}-${var.environment}-critical"
  }
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count = var.alert_email != null ? 1 : 0

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "critical_email" {
  count = var.alert_email != null ? 1 : 0

  topic_arn = aws_sns_topic.critical.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "alerts_slack" {
  count = var.slack_webhook_url != null ? 1 : 0

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}

# -----------------------------------------------------------------------------
# ECS Service Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  for_each = var.ecs_services

  alarm_name          = "${var.project}-${var.environment}-${each.key}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_threshold
  alarm_description   = "ECS service ${each.key} CPU utilization is high"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = each.value.service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "${var.project}-${var.environment}-${each.key}-cpu-high"
    Service = each.key
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  for_each = var.ecs_services

  alarm_name          = "${var.project}-${var.environment}-${each.key}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.memory_threshold
  alarm_description   = "ECS service ${each.key} memory utilization is high"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = each.value.service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name    = "${var.project}-${var.environment}-${each.key}-memory-high"
    Service = each.key
  }
}

# -----------------------------------------------------------------------------
# RDS Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  count = var.rds_instance_id != null ? 1 : 0

  alarm_name          = "${var.project}-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_cpu_threshold
  alarm_description   = "RDS CPU utilization is high"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${var.project}-${var.environment}-rds-cpu-high"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  count = var.rds_instance_id != null ? 1 : 0

  alarm_name          = "${var.project}-${var.environment}-rds-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_connections_threshold
  alarm_description   = "RDS connection count is high"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${var.project}-${var.environment}-rds-connections"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  count = var.rds_instance_id != null ? 1 : 0

  alarm_name          = "${var.project}-${var.environment}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_free_storage_threshold
  alarm_description   = "RDS free storage is low"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.critical.arn]
  ok_actions    = [aws_sns_topic.critical.arn]

  tags = {
    Name = "${var.project}-${var.environment}-rds-storage-low"
  }
}

# -----------------------------------------------------------------------------
# ElastiCache Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  count = var.redis_cluster_id != null ? 1 : 0

  alarm_name          = "${var.project}-${var.environment}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.redis_cpu_threshold
  alarm_description   = "Redis CPU utilization is high"

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${var.project}-${var.environment}-redis-cpu-high"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  count = var.redis_cluster_id != null ? 1 : 0

  alarm_name          = "${var.project}-${var.environment}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.redis_memory_threshold
  alarm_description   = "Redis memory utilization is high"

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${var.project}-${var.environment}-redis-memory-high"
  }
}

# -----------------------------------------------------------------------------
# ALB Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  count = var.alb_arn_suffix != null ? 1 : 0

  alarm_name          = "${var.project}-${var.environment}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alb_5xx_threshold
  alarm_description   = "ALB 5XX error count is high"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions             = [aws_sns_topic.critical.arn]
  ok_actions                = [aws_sns_topic.critical.arn]
  treat_missing_data        = "notBreaching"

  tags = {
    Name = "${var.project}-${var.environment}-alb-5xx"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  count = var.alb_arn_suffix != null ? 1 : 0

  alarm_name          = "${var.project}-${var.environment}-alb-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p99"
  threshold           = var.alb_latency_threshold
  alarm_description   = "ALB p99 latency is high"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions      = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]
  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project}-${var.environment}-alb-latency"
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Dashboard
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = concat(
      # ECS widgets
      [
        {
          type   = "text"
          x      = 0
          y      = 0
          width  = 24
          height = 1
          properties = {
            markdown = "# ${var.project} - ${var.environment} Dashboard"
          }
        },
        {
          type   = "metric"
          x      = 0
          y      = 1
          width  = 12
          height = 6
          properties = {
            title  = "ECS CPU Utilization"
            region = var.aws_region
            metrics = [
              for name, svc in var.ecs_services : [
                "AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", svc.service_name
              ]
            ]
            period = 300
            stat   = "Average"
          }
        },
        {
          type   = "metric"
          x      = 12
          y      = 1
          width  = 12
          height = 6
          properties = {
            title  = "ECS Memory Utilization"
            region = var.aws_region
            metrics = [
              for name, svc in var.ecs_services : [
                "AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", svc.service_name
              ]
            ]
            period = 300
            stat   = "Average"
          }
        }
      ],
      # RDS widgets
      var.rds_instance_id != null ? [
        {
          type   = "metric"
          x      = 0
          y      = 7
          width  = 8
          height = 6
          properties = {
            title  = "RDS CPU Utilization"
            region = var.aws_region
            metrics = [
              ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_id]
            ]
            period = 300
            stat   = "Average"
          }
        },
        {
          type   = "metric"
          x      = 8
          y      = 7
          width  = 8
          height = 6
          properties = {
            title  = "RDS Connections"
            region = var.aws_region
            metrics = [
              ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.rds_instance_id]
            ]
            period = 300
            stat   = "Average"
          }
        },
        {
          type   = "metric"
          x      = 16
          y      = 7
          width  = 8
          height = 6
          properties = {
            title  = "RDS Free Storage"
            region = var.aws_region
            metrics = [
              ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.rds_instance_id]
            ]
            period = 300
            stat   = "Average"
          }
        }
      ] : [],
      # ALB widgets
      var.alb_arn_suffix != null ? [
        {
          type   = "metric"
          x      = 0
          y      = 13
          width  = 12
          height = 6
          properties = {
            title  = "ALB Request Count"
            region = var.aws_region
            metrics = [
              ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix]
            ]
            period = 300
            stat   = "Sum"
          }
        },
        {
          type   = "metric"
          x      = 12
          y      = 13
          width  = 12
          height = 6
          properties = {
            title  = "ALB Response Time"
            region = var.aws_region
            metrics = [
              ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p50", label = "p50" }],
              ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p99", label = "p99" }]
            ]
            period = 300
          }
        }
      ] : []
    )
  })
}
