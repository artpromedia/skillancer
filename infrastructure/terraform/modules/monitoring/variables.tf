# =============================================================================
# Monitoring Module Variables
# =============================================================================

variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# Notifications
variable "alert_email" {
  description = "Email for alerts"
  type        = string
  default     = null
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  default     = null
  sensitive   = true
}

# ECS
variable "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "ecs_services" {
  description = "Map of ECS services to monitor"
  type = map(object({
    service_name = string
  }))
  default = {}
}

variable "cpu_threshold" {
  description = "CPU threshold for ECS alarms"
  type        = number
  default     = 80
}

variable "memory_threshold" {
  description = "Memory threshold for ECS alarms"
  type        = number
  default     = 80
}

# RDS
variable "rds_instance_id" {
  description = "RDS instance identifier"
  type        = string
  default     = null
}

variable "rds_cpu_threshold" {
  description = "CPU threshold for RDS alarms"
  type        = number
  default     = 80
}

variable "rds_connections_threshold" {
  description = "Connection count threshold for RDS alarms"
  type        = number
  default     = 100
}

variable "rds_free_storage_threshold" {
  description = "Free storage threshold for RDS alarms (bytes)"
  type        = number
  default     = 10737418240 # 10GB
}

# Redis
variable "redis_cluster_id" {
  description = "Redis cluster identifier"
  type        = string
  default     = null
}

variable "redis_cpu_threshold" {
  description = "CPU threshold for Redis alarms"
  type        = number
  default     = 80
}

variable "redis_memory_threshold" {
  description = "Memory threshold for Redis alarms"
  type        = number
  default     = 80
}

# ALB
variable "alb_arn_suffix" {
  description = "ALB ARN suffix for metrics"
  type        = string
  default     = null
}

variable "alb_5xx_threshold" {
  description = "5XX error count threshold for ALB alarms"
  type        = number
  default     = 10
}

variable "alb_latency_threshold" {
  description = "Latency threshold for ALB alarms (seconds)"
  type        = number
  default     = 1
}

# =============================================================================
# Logging Module Variables
# =============================================================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "skillancer"
}

variable "services" {
  description = "List of service names to create log groups for"
  type        = list(string)
  default     = []
}

variable "audit_log_retention_days" {
  description = "Retention in days for audit and security logs"
  type        = number
  default     = 365
}

variable "metric_namespace" {
  description = "CloudWatch metric namespace for custom metrics"
  type        = string
  default     = "Skillancer/Application"
}

variable "alarm_sns_topic_arns" {
  description = "SNS topic ARNs for alarm notifications"
  type        = list(string)
  default     = []
}

variable "critical_alarm_sns_topic_arns" {
  description = "SNS topic ARNs for critical alarm notifications"
  type        = list(string)
  default     = []
}

variable "enable_log_archive" {
  description = "Enable S3 archival of CloudWatch logs"
  type        = bool
  default     = false
}

variable "log_archive_kms_key_id" {
  description = "KMS key ID for S3 log archive encryption"
  type        = string
  default     = null
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
