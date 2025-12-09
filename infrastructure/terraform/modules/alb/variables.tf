# =============================================================================
# ALB Module Variables
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
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the ALB"
  type        = list(string)
}

variable "internal" {
  description = "Whether the ALB is internal"
  type        = bool
  default     = false
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the ALB"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

variable "ssl_policy" {
  description = "SSL policy for HTTPS listener"
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
}

variable "idle_timeout" {
  description = "Idle timeout in seconds"
  type        = number
  default     = 60
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "access_logs_bucket" {
  description = "S3 bucket for access logs"
  type        = string
  default     = null
}

variable "access_logs_prefix" {
  description = "Prefix for access logs"
  type        = string
  default     = "alb-logs"
}

variable "services" {
  description = "List of services to create target groups for"
  type = list(object({
    name                  = string
    port                  = number
    priority              = optional(number)
    host_header           = optional(string)
    path_pattern          = optional(string)
    deregistration_delay  = optional(number, 30)
    stickiness_enabled    = optional(bool, false)
    stickiness_duration   = optional(number, 86400)
    health_check = object({
      path                = string
      healthy_threshold   = optional(number, 2)
      unhealthy_threshold = optional(number, 3)
      timeout             = optional(number, 5)
      interval            = optional(number, 30)
      matcher             = optional(string, "200")
    })
  }))
  default = []
}

variable "waf_acl_arn" {
  description = "WAF Web ACL ARN to associate"
  type        = string
  default     = null
}
