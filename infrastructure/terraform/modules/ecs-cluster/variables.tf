# =============================================================================
# ECS Cluster Module Variables
# =============================================================================

variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for service discovery"
  type        = string
}

variable "enable_container_insights" {
  description = "Enable Container Insights for the cluster"
  type        = bool
  default     = true
}

variable "use_fargate_spot" {
  description = "Use Fargate Spot for cost savings (non-production)"
  type        = bool
  default     = false
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
