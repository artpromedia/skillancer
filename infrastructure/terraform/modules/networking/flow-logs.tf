# =============================================================================
# VPC Flow Logs
# =============================================================================
# VPC Flow Logs capture information about IP traffic going to and from
# network interfaces in the VPC. Useful for:
# - Security analysis and troubleshooting
# - Compliance auditing
# - Network traffic patterns analysis
# =============================================================================

# -----------------------------------------------------------------------------
# CloudWatch Log Group for Flow Logs
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  name              = "/aws/vpc-flow-logs/${local.name_prefix}"
  retention_in_days = var.flow_logs_retention_days
  kms_key_id        = var.flow_logs_kms_key_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-flow-logs"
  })
}

# -----------------------------------------------------------------------------
# IAM Role for Flow Logs
# -----------------------------------------------------------------------------

resource "aws_iam_role" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  name = "${local.name_prefix}-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-flow-logs-role"
  })
}

resource "aws_iam_role_policy" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0

  name = "${local.name_prefix}-flow-logs-policy"
  role = aws_iam_role.flow_logs[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# VPC Flow Log
# -----------------------------------------------------------------------------

resource "aws_flow_log" "main" {
  count = var.enable_flow_logs ? 1 : 0

  vpc_id                   = aws_vpc.main.id
  traffic_type             = var.flow_logs_traffic_type
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.flow_logs[0].arn
  iam_role_arn             = aws_iam_role.flow_logs[0].arn
  max_aggregation_interval = var.flow_logs_aggregation_interval

  # Custom log format for more detailed analysis
  log_format = var.flow_logs_custom_format != null ? var.flow_logs_custom_format : null

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-flow-logs"
  })
}

# -----------------------------------------------------------------------------
# Optional: S3 Flow Logs (for long-term storage/analysis)
# -----------------------------------------------------------------------------

resource "aws_flow_log" "s3" {
  count = var.enable_flow_logs && var.flow_logs_s3_bucket_arn != null ? 1 : 0

  vpc_id                   = aws_vpc.main.id
  traffic_type             = var.flow_logs_traffic_type
  log_destination_type     = "s3"
  log_destination          = var.flow_logs_s3_bucket_arn
  max_aggregation_interval = var.flow_logs_aggregation_interval

  # Parquet format for efficient querying in Athena
  destination_options {
    file_format                = "parquet"
    hive_compatible_partitions = true
    per_hour_partition         = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-flow-logs-s3"
  })
}
