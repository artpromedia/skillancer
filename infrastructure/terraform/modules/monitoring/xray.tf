# AWS X-Ray Configuration
# Sampling rules, groups, and IAM policies for distributed tracing

# =============================================================================
# X-Ray Sampling Rules
# =============================================================================

# Default sampling rule - sample 5% of requests
resource "aws_xray_sampling_rule" "default" {
  rule_name      = "${var.project_name}-${var.environment}-default"
  priority       = 10000
  version        = 1
  reservoir_size = 5
  fixed_rate     = 0.05  # 5% sampling rate
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  attributes = {}

  tags = {
    Name        = "${var.project_name}-${var.environment}-default-sampling"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# Sample all errors (100%)
resource "aws_xray_sampling_rule" "errors" {
  rule_name      = "${var.project_name}-${var.environment}-errors"
  priority       = 1000
  version        = 1
  reservoir_size = 10
  fixed_rate     = 1.0  # 100% sampling for errors
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  attributes = {
    "http.status_code" = "5*"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-errors-sampling"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# Sample high-latency requests (100% for requests > 1s)
resource "aws_xray_sampling_rule" "high_latency" {
  rule_name      = "${var.project_name}-${var.environment}-high-latency"
  priority       = 2000
  version        = 1
  reservoir_size = 10
  fixed_rate     = 1.0  # 100% for high latency
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  attributes = {}

  tags = {
    Name        = "${var.project_name}-${var.environment}-high-latency-sampling"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# API Gateway sampling rule (higher rate for API traffic)
resource "aws_xray_sampling_rule" "api_gateway" {
  rule_name      = "${var.project_name}-${var.environment}-api"
  priority       = 3000
  version        = 1
  reservoir_size = 20
  fixed_rate     = 0.10  # 10% for API traffic
  url_path       = "/api/*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  attributes = {}

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-sampling"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# Critical payment endpoints (100% sampling)
resource "aws_xray_sampling_rule" "payments" {
  rule_name      = "${var.project_name}-${var.environment}-payments"
  priority       = 500
  version        = 1
  reservoir_size = 50
  fixed_rate     = 1.0  # 100% for payment operations
  url_path       = "*/payment*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  attributes = {}

  tags = {
    Name        = "${var.project_name}-${var.environment}-payments-sampling"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# =============================================================================
# X-Ray Groups
# =============================================================================

# Group for error traces
resource "aws_xray_group" "errors" {
  group_name        = "${var.project_name}-${var.environment}-errors"
  filter_expression = "responsetime > 1 OR error = true OR fault = true"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = var.xray_insights_notifications_enabled
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-errors-group"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# Group for API service traces
resource "aws_xray_group" "api_service" {
  group_name        = "${var.project_name}-${var.environment}-api"
  filter_expression = "service(\"${var.project_name}-api-*\")"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = var.xray_insights_notifications_enabled
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-group"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# Group for database operations
resource "aws_xray_group" "database" {
  group_name        = "${var.project_name}-${var.environment}-database"
  filter_expression = "service(type(database))"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = false
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-database-group"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# Group for high-latency traces
resource "aws_xray_group" "high_latency" {
  group_name        = "${var.project_name}-${var.environment}-high-latency"
  filter_expression = "responsetime > 2"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = var.xray_insights_notifications_enabled
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-high-latency-group"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# =============================================================================
# X-Ray IAM Policy
# =============================================================================

# IAM policy for X-Ray daemon and SDK
resource "aws_iam_policy" "xray" {
  name        = "${var.project_name}-${var.environment}-xray-policy"
  description = "IAM policy for AWS X-Ray tracing"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "XRayWriteAccess"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries"
        ]
        Resource = "*"
      },
      {
        Sid    = "XRayReadAccess"
        Effect = "Allow"
        Action = [
          "xray:GetTraceSummaries",
          "xray:BatchGetTraces",
          "xray:GetServiceGraph",
          "xray:GetTraceGraph",
          "xray:GetInsightSummaries",
          "xray:GetInsight",
          "xray:GetInsightEvents",
          "xray:GetInsightImpactGraph",
          "xray:GetTimeSeriesServiceStatistics",
          "xray:GetGroups",
          "xray:GetGroup"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-xray-policy"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}

# =============================================================================
# CloudWatch Log Group for X-Ray (optional - for OTLP collector logs)
# =============================================================================

resource "aws_cloudwatch_log_group" "xray" {
  name              = "/aws/xray/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-${var.environment}-xray-logs"
    Environment = var.environment
    Project     = var.project_name
    Terraform   = "true"
  }
}
