#------------------------------------------------------------------------------
# CloudWatch Logging Infrastructure for Skillancer
#
# This module creates comprehensive logging infrastructure including:
# - Log groups for application, audit, and security logs
# - Metric filters for error detection and alerting
# - CloudWatch Logs Insights queries for common analysis patterns
# - S3 archival for long-term log retention (optional)
#------------------------------------------------------------------------------

#------------------------------------------------------------------------------
# CloudWatch Log Groups
#------------------------------------------------------------------------------

# Application log group - general application logs
resource "aws_cloudwatch_log_group" "application" {
  name              = "/skillancer/${var.environment}/application"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-application-logs"
    LogType     = "application"
    Environment = var.environment
  })
}

# Audit log group - for compliance and audit trails
resource "aws_cloudwatch_log_group" "audit" {
  name              = "/skillancer/${var.environment}/audit"
  retention_in_days = var.audit_log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-audit-logs"
    LogType     = "audit"
    Environment = var.environment
  })
}

# Security log group - security-related events
resource "aws_cloudwatch_log_group" "security" {
  name              = "/skillancer/${var.environment}/security"
  retention_in_days = var.audit_log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-security-logs"
    LogType     = "security"
    Environment = var.environment
  })
}

# Per-service log groups for ECS services
resource "aws_cloudwatch_log_group" "service" {
  for_each = toset(var.services)

  name              = "/ecs/skillancer-${var.environment}/${each.value}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-${each.value}-logs"
    LogType     = "service"
    Service     = each.value
    Environment = var.environment
  })
}

#------------------------------------------------------------------------------
# CloudWatch Metric Filters
#------------------------------------------------------------------------------

# Error count metric filter
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "${var.project_name}-${var.environment}-error-count"
  pattern        = "{ $.level = \"ERROR\" }"
  log_group_name = aws_cloudwatch_log_group.application.name

  metric_transformation {
    name          = "ErrorCount"
    namespace     = var.metric_namespace
    value         = "1"
    default_value = "0"
  }
}

# Warning count metric filter
resource "aws_cloudwatch_log_metric_filter" "warn_count" {
  name           = "${var.project_name}-${var.environment}-warn-count"
  pattern        = "{ $.level = \"WARN\" }"
  log_group_name = aws_cloudwatch_log_group.application.name

  metric_transformation {
    name          = "WarnCount"
    namespace     = var.metric_namespace
    value         = "1"
    default_value = "0"
  }
}

# Fatal error metric filter
resource "aws_cloudwatch_log_metric_filter" "fatal_count" {
  name           = "${var.project_name}-${var.environment}-fatal-count"
  pattern        = "{ $.level = \"FATAL\" }"
  log_group_name = aws_cloudwatch_log_group.application.name

  metric_transformation {
    name          = "FatalErrorCount"
    namespace     = var.metric_namespace
    value         = "1"
    default_value = "0"
  }
}

# HTTP 4xx errors
resource "aws_cloudwatch_log_metric_filter" "http_4xx" {
  name           = "${var.project_name}-${var.environment}-http-4xx"
  pattern        = "{ $.statusCode >= 400 && $.statusCode < 500 }"
  log_group_name = aws_cloudwatch_log_group.application.name

  metric_transformation {
    name          = "HTTP4xxCount"
    namespace     = var.metric_namespace
    value         = "1"
    default_value = "0"
  }
}

# HTTP 5xx errors
resource "aws_cloudwatch_log_metric_filter" "http_5xx" {
  name           = "${var.project_name}-${var.environment}-http-5xx"
  pattern        = "{ $.statusCode >= 500 }"
  log_group_name = aws_cloudwatch_log_group.application.name

  metric_transformation {
    name          = "HTTP5xxCount"
    namespace     = var.metric_namespace
    value         = "1"
    default_value = "0"
  }
}

# Response time metric
resource "aws_cloudwatch_log_metric_filter" "response_time" {
  name           = "${var.project_name}-${var.environment}-response-time"
  pattern        = "{ $.responseTime = * }"
  log_group_name = aws_cloudwatch_log_group.application.name

  metric_transformation {
    name      = "ResponseTime"
    namespace = var.metric_namespace
    value     = "$.responseTime"
  }
}

# Slow request metric (> 1 second)
resource "aws_cloudwatch_log_metric_filter" "slow_requests" {
  name           = "${var.project_name}-${var.environment}-slow-requests"
  pattern        = "{ $.responseTime > 1000 }"
  log_group_name = aws_cloudwatch_log_group.application.name

  metric_transformation {
    name          = "SlowRequestCount"
    namespace     = var.metric_namespace
    value         = "1"
    default_value = "0"
  }
}

# Authentication failures
resource "aws_cloudwatch_log_metric_filter" "auth_failures" {
  name           = "${var.project_name}-${var.environment}-auth-failures"
  pattern        = "{ $.msg = \"*authentication*failed*\" || $.msg = \"*unauthorized*\" || $.msg = \"*invalid*token*\" }"
  log_group_name = aws_cloudwatch_log_group.security.name

  metric_transformation {
    name          = "AuthFailureCount"
    namespace     = var.metric_namespace
    value         = "1"
    default_value = "0"
  }
}

# Suspicious activity metric
resource "aws_cloudwatch_log_metric_filter" "suspicious_activity" {
  name           = "${var.project_name}-${var.environment}-suspicious-activity"
  pattern        = "{ $.msg = \"*suspicious*\" || $.msg = \"*security*alert*\" || $.level = \"SECURITY\" }"
  log_group_name = aws_cloudwatch_log_group.security.name

  metric_transformation {
    name          = "SuspiciousActivityCount"
    namespace     = var.metric_namespace
    value         = "1"
    default_value = "0"
  }
}

#------------------------------------------------------------------------------
# CloudWatch Alarms
#------------------------------------------------------------------------------

# High error rate alarm
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ErrorCount"
  namespace           = var.metric_namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "High error rate detected in ${var.environment}"
  alarm_actions       = var.alarm_sns_topic_arns
  ok_actions          = var.alarm_sns_topic_arns

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-high-error-rate-alarm"
  })
}

# Fatal error alarm
resource "aws_cloudwatch_metric_alarm" "fatal_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-fatal-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FatalErrorCount"
  namespace           = var.metric_namespace
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Fatal error detected in ${var.environment}"
  alarm_actions       = var.critical_alarm_sns_topic_arns
  ok_actions          = var.critical_alarm_sns_topic_arns

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-fatal-errors-alarm"
  })
}

# HTTP 5xx alarm
resource "aws_cloudwatch_metric_alarm" "http_5xx_alarm" {
  alarm_name          = "${var.project_name}-${var.environment}-http-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTP5xxCount"
  namespace           = var.metric_namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "High HTTP 5xx error rate in ${var.environment}"
  alarm_actions       = var.critical_alarm_sns_topic_arns
  ok_actions          = var.critical_alarm_sns_topic_arns

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-http-5xx-alarm"
  })
}

# Slow requests alarm
resource "aws_cloudwatch_metric_alarm" "slow_requests_alarm" {
  alarm_name          = "${var.project_name}-${var.environment}-slow-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "SlowRequestCount"
  namespace           = var.metric_namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 20
  alarm_description   = "High number of slow requests in ${var.environment}"
  alarm_actions       = var.alarm_sns_topic_arns
  ok_actions          = var.alarm_sns_topic_arns

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-slow-requests-alarm"
  })
}

# Authentication failures alarm
resource "aws_cloudwatch_metric_alarm" "auth_failures_alarm" {
  alarm_name          = "${var.project_name}-${var.environment}-auth-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "AuthFailureCount"
  namespace           = var.metric_namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "High number of authentication failures in ${var.environment}"
  alarm_actions       = var.critical_alarm_sns_topic_arns
  ok_actions          = var.critical_alarm_sns_topic_arns

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-auth-failures-alarm"
  })
}

#------------------------------------------------------------------------------
# CloudWatch Logs Insights Queries (Saved Queries)
#------------------------------------------------------------------------------

resource "aws_cloudwatch_query_definition" "error_summary" {
  name = "${var.project_name}/${var.environment}/Error Summary"

  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]

  query_string = <<-EOT
    fields @timestamp, @message, level, service, error.message, error.stack
    | filter level = "ERROR" or level = "FATAL"
    | sort @timestamp desc
    | limit 100
  EOT
}

resource "aws_cloudwatch_query_definition" "slow_requests" {
  name = "${var.project_name}/${var.environment}/Slow Requests"

  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]

  query_string = <<-EOT
    fields @timestamp, method, path, statusCode, responseTime, requestId
    | filter responseTime > 1000
    | sort responseTime desc
    | limit 100
  EOT
}

resource "aws_cloudwatch_query_definition" "requests_by_endpoint" {
  name = "${var.project_name}/${var.environment}/Requests by Endpoint"

  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]

  query_string = <<-EOT
    fields @timestamp, method, path, statusCode, responseTime
    | filter msg = "request completed"
    | stats count(*) as requestCount, avg(responseTime) as avgResponseTime, 
            pct(responseTime, 95) as p95ResponseTime by method, path
    | sort requestCount desc
    | limit 50
  EOT
}

resource "aws_cloudwatch_query_definition" "error_rate_by_endpoint" {
  name = "${var.project_name}/${var.environment}/Error Rate by Endpoint"

  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]

  query_string = <<-EOT
    fields @timestamp, method, path, statusCode
    | filter statusCode >= 400
    | stats count(*) as errorCount by method, path, statusCode
    | sort errorCount desc
    | limit 50
  EOT
}

resource "aws_cloudwatch_query_definition" "user_activity" {
  name = "${var.project_name}/${var.environment}/User Activity"

  log_group_names = [
    aws_cloudwatch_log_group.audit.name
  ]

  query_string = <<-EOT
    fields @timestamp, userId, action, resource, details
    | sort @timestamp desc
    | limit 100
  EOT
}

resource "aws_cloudwatch_query_definition" "security_events" {
  name = "${var.project_name}/${var.environment}/Security Events"

  log_group_names = [
    aws_cloudwatch_log_group.security.name
  ]

  query_string = <<-EOT
    fields @timestamp, level, msg, userId, remoteAddress, userAgent
    | filter level = "WARN" or level = "ERROR" or level = "SECURITY"
    | sort @timestamp desc
    | limit 100
  EOT
}

resource "aws_cloudwatch_query_definition" "request_trace" {
  name = "${var.project_name}/${var.environment}/Request Trace"

  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]

  query_string = <<-EOT
    fields @timestamp, @message, level, service, msg
    | filter requestId = "REPLACE_WITH_REQUEST_ID"
    | sort @timestamp asc
  EOT
}

resource "aws_cloudwatch_query_definition" "response_time_percentiles" {
  name = "${var.project_name}/${var.environment}/Response Time Percentiles"

  log_group_names = [
    aws_cloudwatch_log_group.application.name
  ]

  query_string = <<-EOT
    fields @timestamp, responseTime
    | filter msg = "request completed"
    | stats avg(responseTime) as avg, 
            pct(responseTime, 50) as p50,
            pct(responseTime, 90) as p90,
            pct(responseTime, 99) as p99
            by bin(1h)
    | sort @timestamp
  EOT
}

#------------------------------------------------------------------------------
# S3 Log Archive (Optional)
#------------------------------------------------------------------------------

resource "aws_s3_bucket" "log_archive" {
  count = var.enable_log_archive ? 1 : 0

  bucket = "${var.project_name}-${var.environment}-log-archive-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-log-archive"
    Environment = var.environment
  })
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_versioning" "log_archive" {
  count = var.enable_log_archive ? 1 : 0

  bucket = aws_s3_bucket.log_archive[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "log_archive" {
  count = var.enable_log_archive ? 1 : 0

  bucket = aws_s3_bucket.log_archive[0].id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.log_archive_kms_key_id
      sse_algorithm     = var.log_archive_kms_key_id != null ? "aws:kms" : "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "log_archive" {
  count = var.enable_log_archive ? 1 : 0

  bucket = aws_s3_bucket.log_archive[0].id

  rule {
    id     = "archive-logs"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 2555 # 7 years for compliance
    }
  }
}

resource "aws_s3_bucket_public_access_block" "log_archive" {
  count = var.enable_log_archive ? 1 : 0

  bucket = aws_s3_bucket.log_archive[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudWatch Logs subscription to Kinesis Firehose for S3 archival
resource "aws_kinesis_firehose_delivery_stream" "log_archive" {
  count = var.enable_log_archive ? 1 : 0

  name        = "${var.project_name}-${var.environment}-log-archive"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose_role[0].arn
    bucket_arn = aws_s3_bucket.log_archive[0].arn

    buffering_size     = 64
    buffering_interval = 300

    compression_format = "GZIP"

    prefix              = "logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    error_output_prefix = "errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose[0].name
      log_stream_name = "delivery"
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-log-archive-firehose"
  })
}

resource "aws_cloudwatch_log_group" "firehose" {
  count = var.enable_log_archive ? 1 : 0

  name              = "/aws/firehose/${var.project_name}-${var.environment}-log-archive"
  retention_in_days = 14

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-firehose-logs"
  })
}

resource "aws_iam_role" "firehose_role" {
  count = var.enable_log_archive ? 1 : 0

  name = "${var.project_name}-${var.environment}-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-firehose-role"
  })
}

resource "aws_iam_role_policy" "firehose_policy" {
  count = var.enable_log_archive ? 1 : 0

  name = "${var.project_name}-${var.environment}-firehose-policy"
  role = aws_iam_role.firehose_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = [
          aws_s3_bucket.log_archive[0].arn,
          "${aws_s3_bucket.log_archive[0].arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.firehose[0].arn}:*"
        ]
      }
    ]
  })
}

# CloudWatch Logs subscription filter to Firehose
resource "aws_cloudwatch_log_subscription_filter" "application_to_firehose" {
  count = var.enable_log_archive ? 1 : 0

  name            = "${var.project_name}-${var.environment}-application-to-firehose"
  log_group_name  = aws_cloudwatch_log_group.application.name
  filter_pattern  = ""
  destination_arn = aws_kinesis_firehose_delivery_stream.log_archive[0].arn
  role_arn        = aws_iam_role.cloudwatch_to_firehose[0].arn
}

resource "aws_iam_role" "cloudwatch_to_firehose" {
  count = var.enable_log_archive ? 1 : 0

  name = "${var.project_name}-${var.environment}-cw-to-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-cw-to-firehose-role"
  })
}

resource "aws_iam_role_policy" "cloudwatch_to_firehose_policy" {
  count = var.enable_log_archive ? 1 : 0

  name = "${var.project_name}-${var.environment}-cw-to-firehose-policy"
  role = aws_iam_role.cloudwatch_to_firehose[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "firehose:PutRecord",
          "firehose:PutRecordBatch"
        ]
        Resource = [
          aws_kinesis_firehose_delivery_stream.log_archive[0].arn
        ]
      }
    ]
  })
}
