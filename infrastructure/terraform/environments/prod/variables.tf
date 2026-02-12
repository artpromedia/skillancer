# =============================================================================
# Variables - Production Environment
# =============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain" {
  description = "Base domain for the environment"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.2.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = []
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.2.11.0/24", "10.2.12.0/24", "10.2.13.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.2.21.0/24", "10.2.22.0/24", "10.2.23.0/24"]
}

variable "service_names" {
  description = "List of ECS service names"
  type        = list(string)
  default = [
    "api-gateway",
    "auth-svc",
    "market-svc",
    "skillpod-svc",
    "cockpit-svc",
    "billing-svc",
    "notification-svc",
    "audit-svc"
  ]
}

variable "service_cpu" {
  description = "CPU units for ECS services"
  type        = number
  default     = 1024
}

variable "service_memory" {
  description = "Memory for ECS services in MB"
  type        = number
  default     = 2048
}

variable "container_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.1"
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "rds_allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage" {
  description = "Maximum allocated storage in GB"
  type        = number
  default     = 1000
}

variable "rds_kms_key_id" {
  description = "KMS key ID for RDS encryption"
  type        = string
  default     = ""
}

variable "create_rds_read_replica" {
  description = "Create RDS read replica"
  type        = bool
  default     = true
}

variable "rds_read_replica_count" {
  description = "Number of RDS read replicas"
  type        = number
  default     = 1
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "alb_access_logs_bucket" {
  description = "S3 bucket for ALB access logs"
  type        = string
}

variable "s3_bucket_arns" {
  description = "S3 bucket ARNs for ECS task role"
  type        = list(string)
  default     = []
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
}

variable "alert_webhook_url" {
  description = "Webhook URL for alerts"
  type        = string
  default     = ""
  sensitive   = true
}

variable "pagerduty_service_key" {
  description = "PagerDuty service key for critical alerts"
  type        = string
  default     = ""
  sensitive   = true
}
