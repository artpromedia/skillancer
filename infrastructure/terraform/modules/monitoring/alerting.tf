# =============================================================================
# Alerting Configuration - PagerDuty Integration
# CloudWatch -> SNS -> Lambda -> PagerDuty Events API v2
# =============================================================================

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------

variable "pagerduty_routing_key" {
  description = "PagerDuty Events API v2 routing key (integration key)"
  type        = string
  default     = null
  sensitive   = true
}

variable "enable_pagerduty" {
  description = "Enable PagerDuty integration"
  type        = bool
  default     = false
}

variable "pagerduty_source_prefix" {
  description = "Source prefix for PagerDuty alerts"
  type        = string
  default     = "aws"
}

# -----------------------------------------------------------------------------
# Locals
# -----------------------------------------------------------------------------

locals {
  pagerduty_enabled = var.enable_pagerduty && var.pagerduty_routing_key != null
  function_name     = "${var.project}-${var.environment}-pagerduty-forwarder"
}

# -----------------------------------------------------------------------------
# SNS Topic for PagerDuty
# -----------------------------------------------------------------------------

resource "aws_sns_topic" "pagerduty" {
  count = local.pagerduty_enabled ? 1 : 0

  name = "${var.project}-${var.environment}-pagerduty"

  tags = merge(var.tags, {
    Name    = "${var.project}-${var.environment}-pagerduty"
    Purpose = "PagerDuty alert forwarding"
  })
}

resource "aws_sns_topic_policy" "pagerduty" {
  count = local.pagerduty_enabled ? 1 : 0

  arn = aws_sns_topic.pagerduty[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchAlarms"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.pagerduty[0].arn
        Condition = {
          ArnLike = {
            "aws:SourceArn" = "arn:aws:cloudwatch:${var.aws_region}:*:alarm:*"
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# IAM Role for Lambda
# -----------------------------------------------------------------------------

resource "aws_iam_role" "pagerduty_forwarder" {
  count = local.pagerduty_enabled ? 1 : 0

  name = "${var.project}-${var.environment}-pagerduty-forwarder"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name    = "${var.project}-${var.environment}-pagerduty-forwarder"
    Purpose = "Lambda role for PagerDuty forwarding"
  })
}

resource "aws_iam_role_policy" "pagerduty_forwarder" {
  count = local.pagerduty_enabled ? 1 : 0

  name = "${var.project}-${var.environment}-pagerduty-forwarder"
  role = aws_iam_role.pagerduty_forwarder[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      },
      {
        Sid    = "SNSRead"
        Effect = "Allow"
        Action = [
          "sns:GetTopicAttributes",
          "sns:ListSubscriptionsByTopic"
        ]
        Resource = aws_sns_topic.pagerduty[0].arn
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Lambda Function
# -----------------------------------------------------------------------------

data "archive_file" "pagerduty_forwarder" {
  count = local.pagerduty_enabled ? 1 : 0

  type        = "zip"
  source_dir  = "${path.module}/lambda/pagerduty"
  output_path = "${path.module}/lambda/pagerduty.zip"
}

resource "aws_lambda_function" "pagerduty_forwarder" {
  count = local.pagerduty_enabled ? 1 : 0

  function_name = local.function_name
  role          = aws_iam_role.pagerduty_forwarder[0].arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 128

  filename         = data.archive_file.pagerduty_forwarder[0].output_path
  source_code_hash = data.archive_file.pagerduty_forwarder[0].output_base64sha256

  environment {
    variables = {
      PAGERDUTY_ROUTING_KEY = var.pagerduty_routing_key
      ENVIRONMENT           = var.environment
      PROJECT               = var.project
      SOURCE_PREFIX         = var.pagerduty_source_prefix
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(var.tags, {
    Name    = local.function_name
    Purpose = "CloudWatch to PagerDuty alert forwarding"
  })
}

resource "aws_cloudwatch_log_group" "pagerduty_forwarder" {
  count = local.pagerduty_enabled ? 1 : 0

  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14

  tags = merge(var.tags, {
    Name = local.function_name
  })
}

# -----------------------------------------------------------------------------
# SNS Subscription
# -----------------------------------------------------------------------------

resource "aws_sns_topic_subscription" "pagerduty" {
  count = local.pagerduty_enabled ? 1 : 0

  topic_arn = aws_sns_topic.pagerduty[0].arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.pagerduty_forwarder[0].arn
}

resource "aws_lambda_permission" "sns_invoke" {
  count = local.pagerduty_enabled ? 1 : 0

  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pagerduty_forwarder[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.pagerduty[0].arn
}

# -----------------------------------------------------------------------------
# Critical Alarm -> PagerDuty Subscription
# Subscribe existing critical SNS topic to PagerDuty
# -----------------------------------------------------------------------------

resource "aws_sns_topic_subscription" "critical_to_pagerduty" {
  count = local.pagerduty_enabled ? 1 : 0

  topic_arn = aws_sns_topic.critical.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.pagerduty_forwarder[0].arn
}

resource "aws_lambda_permission" "critical_sns_invoke" {
  count = local.pagerduty_enabled ? 1 : 0

  statement_id  = "AllowCriticalSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pagerduty_forwarder[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.critical.arn
}

# -----------------------------------------------------------------------------
# Example: Add alarm action to existing alarms
# (Use this pattern for new alarms that should trigger PagerDuty)
# -----------------------------------------------------------------------------

# resource "aws_cloudwatch_metric_alarm" "example_critical_alarm" {
#   alarm_name          = "${var.project}-${var.environment}-example-critical"
#   comparison_operator = "GreaterThanThreshold"
#   evaluation_periods  = 2
#   metric_name         = "CPUUtilization"
#   namespace           = "AWS/ECS"
#   period              = 60
#   statistic           = "Average"
#   threshold           = 90
#   alarm_description   = "Critical: ECS CPU utilization is too high"
#   
#   dimensions = {
#     ClusterName = var.ecs_cluster_name
#   }
#   
#   # Trigger PagerDuty for ALARM state
#   alarm_actions = local.pagerduty_enabled ? [
#     aws_sns_topic.pagerduty[0].arn,
#     aws_sns_topic.critical.arn
#   ] : [aws_sns_topic.critical.arn]
#   
#   # Resolve PagerDuty incident when OK
#   ok_actions = local.pagerduty_enabled ? [
#     aws_sns_topic.pagerduty[0].arn
#   ] : []
#   
#   tags = var.tags
# }
