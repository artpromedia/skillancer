# =============================================================================
# Networking Module Variables
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

variable "name_prefix" {
  description = "Prefix for resource names (defaults to project-environment)"
  type        = string
  default     = null
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = []
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use a single NAT gateway (cost savings for non-prod)"
  type        = bool
  default     = false
}

variable "enable_flow_logs" {
  description = "Enable VPC flow logs"
  type        = bool
  default     = true
}

variable "flow_logs_retention_days" {
  description = "Flow logs retention in days"
  type        = number
  default     = 30
}

variable "enable_vpc_endpoints" {
  description = "Enable VPC endpoints for AWS services"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Flow Logs Configuration
# -----------------------------------------------------------------------------

variable "flow_logs_traffic_type" {
  description = "Type of traffic to capture (ACCEPT, REJECT, or ALL)"
  type        = string
  default     = "ALL"

  validation {
    condition     = contains(["ACCEPT", "REJECT", "ALL"], var.flow_logs_traffic_type)
    error_message = "Flow logs traffic type must be ACCEPT, REJECT, or ALL."
  }
}

variable "flow_logs_kms_key_id" {
  description = "KMS key ID for encrypting flow logs"
  type        = string
  default     = null
}

variable "flow_logs_aggregation_interval" {
  description = "Maximum interval of time during which a flow of packets is captured (60 or 600 seconds)"
  type        = number
  default     = 600

  validation {
    condition     = contains([60, 600], var.flow_logs_aggregation_interval)
    error_message = "Flow logs aggregation interval must be 60 or 600 seconds."
  }
}

variable "flow_logs_custom_format" {
  description = "Custom log format for flow logs (null for default format)"
  type        = string
  default     = null
}

variable "flow_logs_s3_bucket_arn" {
  description = "S3 bucket ARN for storing flow logs (in addition to CloudWatch)"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Security Configuration
# -----------------------------------------------------------------------------

variable "bastion_security_group_id" {
  description = "Security group ID of bastion host for database access"
  type        = string
  default     = null
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access the ALB"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
