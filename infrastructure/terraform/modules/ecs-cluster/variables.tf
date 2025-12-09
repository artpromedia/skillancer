# =============================================================================
# ECS Cluster Module Variables
# =============================================================================

variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for service discovery"
  type        = string
}

variable "enable_container_insights" {
  description = "Enable Container Insights for enhanced monitoring"
  type        = bool
  default     = true
}

variable "fargate_base_weight" {
  description = "Weight for Fargate (on-demand) capacity provider in production"
  type        = number
  default     = 50
}

variable "fargate_spot_weight" {
  description = "Weight for Fargate Spot capacity provider"
  type        = number
  default     = 50
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "enable_service_discovery" {
  description = "Enable Cloud Map service discovery"
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "KMS key ARN for encrypting logs and secrets"
  type        = string
  default     = null
}

variable "enable_xray" {
  description = "Enable X-Ray tracing for services"
  type        = bool
  default     = false
}

variable "enable_cluster_alarms" {
  description = "Enable CloudWatch alarms for cluster monitoring"
  type        = bool
  default     = true
}

variable "cluster_cpu_alarm_threshold" {
  description = "CPU utilization threshold for cluster alarm"
  type        = number
  default     = 80
}

variable "cluster_memory_alarm_threshold" {
  description = "Memory utilization threshold for cluster alarm"
  type        = number
  default     = 80
}

variable "alarm_sns_topic_arns" {
  description = "SNS topic ARNs for CloudWatch alarm notifications"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
