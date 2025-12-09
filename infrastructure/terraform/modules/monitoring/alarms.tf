#------------------------------------------------------------------------------
# CloudWatch Alarms for Skillancer Platform
#
# This module creates comprehensive alarms for:
# - Application metrics (error rates, latency)
# - Infrastructure metrics (ECS, RDS, ElastiCache)
# - Business metrics anomalies
# - SLO violations
#------------------------------------------------------------------------------

locals {
  alarms_namespace = "${var.project_name}/Services"
}

#------------------------------------------------------------------------------
# SNS Topics for Alarm Notifications
#------------------------------------------------------------------------------

resource "aws_sns_topic" "alarms" {
  name = "${var.project_name}-${var.environment}-alarms"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-alarms"
  })
}

resource "aws_sns_topic" "critical_alarms" {
  name = "${var.project_name}-${var.environment}-critical-alarms"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-critical-alarms"
  })
}

# Email subscription for alerts (if email provided)
resource "aws_sns_topic_subscription" "alarms_email" {
  count = var.alert_email != null ? 1 : 0

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "critical_email" {
  count = var.alert_email != null ? 1 : 0

  topic_arn = aws_sns_topic.critical_alarms.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

#------------------------------------------------------------------------------
# Application Alarms - Error Rates
#------------------------------------------------------------------------------

# High Error Rate Alarm (> 5%)
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 5
  alarm_description   = "Error rate exceeds 5% for 15 minutes"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "errorRate"
    expression  = "(errors/requests)*100"
    label       = "Error Rate"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "ErrorCount"
      namespace   = local.alarms_namespace
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id = "requests"
    metric {
      metric_name = "RequestCount"
      namespace   = local.alarms_namespace
      period      = 300
      stat        = "Sum"
    }
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

# Critical Error Rate Alarm (> 10%)
resource "aws_cloudwatch_metric_alarm" "critical_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-critical-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 10
  alarm_description   = "CRITICAL: Error rate exceeds 10%"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "errorRate"
    expression  = "(errors/requests)*100"
    label       = "Error Rate"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "ErrorCount"
      namespace   = local.alarms_namespace
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id = "requests"
    metric {
      metric_name = "RequestCount"
      namespace   = local.alarms_namespace
      period      = 300
      stat        = "Sum"
    }
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = var.tags
}

#------------------------------------------------------------------------------
# Application Alarms - Latency
#------------------------------------------------------------------------------

# High Latency Alarm (P95 > 1 second)
resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "${var.project_name}-${var.environment}-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "RequestLatency"
  namespace           = local.alarms_namespace
  period              = 300
  extended_statistic  = "p95"
  threshold           = 1000
  alarm_description   = "P95 latency exceeds 1 second for 15 minutes"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

# Critical Latency Alarm (P95 > 3 seconds)
resource "aws_cloudwatch_metric_alarm" "critical_latency" {
  alarm_name          = "${var.project_name}-${var.environment}-critical-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RequestLatency"
  namespace           = local.alarms_namespace
  period              = 300
  extended_statistic  = "p95"
  threshold           = 3000
  alarm_description   = "CRITICAL: P95 latency exceeds 3 seconds"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = var.tags
}

#------------------------------------------------------------------------------
# SLO Alarms
#------------------------------------------------------------------------------

# Low Availability Alarm (< 99.9%)
resource "aws_cloudwatch_metric_alarm" "low_availability" {
  alarm_name          = "${var.project_name}-${var.environment}-low-availability"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  threshold           = 99.9
  alarm_description   = "Availability below 99.9% SLO"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "availability"
    expression  = "((requests-errors)/requests)*100"
    label       = "Availability"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "ErrorCount"
      namespace   = local.alarms_namespace
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id = "requests"
    metric {
      metric_name = "RequestCount"
      namespace   = local.alarms_namespace
      period      = 300
      stat        = "Sum"
    }
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

# Latency SLO Violation (P95 > 500ms sustained)
resource "aws_cloudwatch_metric_alarm" "latency_slo_violation" {
  alarm_name          = "${var.project_name}-${var.environment}-latency-slo-violation"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 6
  metric_name         = "RequestLatency"
  namespace           = local.alarms_namespace
  period              = 300
  extended_statistic  = "p95"
  threshold           = 500
  alarm_description   = "P95 latency SLO violation (> 500ms for 30 minutes)"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

#------------------------------------------------------------------------------
# Per-Service Alarms
#------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "service_errors" {
  for_each = toset(var.services)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ErrorCount"
  namespace           = local.alarms_namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "${each.value} is experiencing elevated errors (> 10 in 5 min)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    Service = each.value
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "service_latency" {
  for_each = toset(var.services)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "RequestLatency"
  namespace           = local.alarms_namespace
  period              = 300
  extended_statistic  = "p95"
  threshold           = 1000
  alarm_description   = "${each.value} P95 latency exceeds 1 second"
  treat_missing_data  = "notBreaching"

  dimensions = {
    Service = each.value
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

#------------------------------------------------------------------------------
# Infrastructure Alarms - ECS
#------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  for_each = toset(var.services)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_threshold
  alarm_description   = "${each.value} ECS CPU utilization > ${var.cpu_threshold}%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = each.value
    ClusterName = var.ecs_cluster_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  for_each = toset(var.services)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.memory_threshold
  alarm_description   = "${each.value} ECS memory utilization > ${var.memory_threshold}%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = each.value
    ClusterName = var.ecs_cluster_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

# ECS Task Count - No running tasks
resource "aws_cloudwatch_metric_alarm" "ecs_no_tasks" {
  for_each = toset(var.services)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-no-tasks"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "CRITICAL: ${each.value} has no running tasks"
  treat_missing_data  = "breaching"

  dimensions = {
    ServiceName = each.value
    ClusterName = var.ecs_cluster_name
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = var.tags
}

#------------------------------------------------------------------------------
# Infrastructure Alarms - RDS
#------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  count = var.rds_instance_id != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_cpu_threshold
  alarm_description   = "RDS CPU utilization > ${var.rds_cpu_threshold}%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  count = var.rds_instance_id != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_connections_threshold
  alarm_description   = "RDS connections > ${var.rds_connections_threshold}"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  count = var.rds_instance_id != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_free_storage_threshold
  alarm_description   = "CRITICAL: RDS free storage below threshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.critical_alarms.arn]
  ok_actions    = [aws_sns_topic.critical_alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_read_latency_high" {
  count = var.rds_instance_id != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-rds-read-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 0.02 # 20ms
  alarm_description   = "RDS read latency > 20ms"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

#------------------------------------------------------------------------------
# Infrastructure Alarms - ElastiCache/Redis
#------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  count = var.redis_cluster_id != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.redis_cpu_threshold
  alarm_description   = "Redis CPU utilization > ${var.redis_cpu_threshold}%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  count = var.redis_cluster_id != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis memory usage > 80%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  count = var.redis_cluster_id != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "Redis evictions detected (> 100 in 5 min)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

#------------------------------------------------------------------------------
# Infrastructure Alarms - ALB
#------------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  count = var.alb_arn_suffix != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "ALB 5xx errors > 10 in 5 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_target_5xx_errors" {
  count = var.alb_arn_suffix != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-alb-target-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 25
  alarm_description   = "ALB target 5xx errors > 25 in 5 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_latency_high" {
  count = var.alb_arn_suffix != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-alb-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  threshold           = var.alb_latency_threshold
  alarm_description   = "ALB P95 latency > ${var.alb_latency_threshold}s"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  count = var.alb_arn_suffix != null && var.alb_target_group_arn_suffix != null ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-alb-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "ALB has unhealthy targets"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.alb_target_group_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = var.tags
}
