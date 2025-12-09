# =============================================================================
# Monitoring Module Outputs
# =============================================================================

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.main.name
}

output "log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.main.arn
}

output "alerts_topic_arn" {
  description = "ARN of the alerts SNS topic"
  value       = aws_sns_topic.alerts.arn
}

output "alerts_topic_name" {
  description = "Name of the alerts SNS topic"
  value       = aws_sns_topic.alerts.name
}

output "critical_topic_arn" {
  description = "ARN of the critical alerts SNS topic"
  value       = aws_sns_topic.critical.arn
}

output "critical_topic_name" {
  description = "Name of the critical alerts SNS topic"
  value       = aws_sns_topic.critical.name
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_arn" {
  description = "ARN of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_arn
}

# =============================================================================
# Logging Module Outputs
# =============================================================================

output "application_log_group_name" {
  description = "Name of the application CloudWatch log group"
  value       = aws_cloudwatch_log_group.application.name
}

output "application_log_group_arn" {
  description = "ARN of the application CloudWatch log group"
  value       = aws_cloudwatch_log_group.application.arn
}

output "audit_log_group_name" {
  description = "Name of the audit CloudWatch log group"
  value       = aws_cloudwatch_log_group.audit.name
}

output "audit_log_group_arn" {
  description = "ARN of the audit CloudWatch log group"
  value       = aws_cloudwatch_log_group.audit.arn
}

output "security_log_group_name" {
  description = "Name of the security CloudWatch log group"
  value       = aws_cloudwatch_log_group.security.name
}

output "security_log_group_arn" {
  description = "ARN of the security CloudWatch log group"
  value       = aws_cloudwatch_log_group.security.arn
}

output "service_log_groups" {
  description = "Map of service names to their log group names"
  value       = { for k, v in aws_cloudwatch_log_group.service : k => v.name }
}

output "metric_namespace" {
  description = "CloudWatch metric namespace for custom metrics"
  value       = var.metric_namespace
}

output "log_archive_bucket" {
  description = "S3 bucket name for log archive (if enabled)"
  value       = var.enable_log_archive ? aws_s3_bucket.log_archive[0].id : null
}
