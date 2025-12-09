# =============================================================================
# RDS Module Variables
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
  description = "Subnet IDs for the database"
  type        = list(string)
}

variable "db_subnet_group_name" {
  description = "Existing DB subnet group name (optional)"
  type        = string
  default     = null
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to connect"
  type        = list(string)
}

# Engine
variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.1"
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

# Storage
variable "allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage in GB for autoscaling"
  type        = number
  default     = 100
}

variable "storage_type" {
  description = "Storage type (gp2, gp3, io1)"
  type        = string
  default     = "gp3"
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = null
}

# Database
variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "skillancer"
}

variable "port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "master_username" {
  description = "Master username"
  type        = string
  default     = "skillancer_admin"
}

variable "master_password" {
  description = "Master password (generated if not provided)"
  type        = string
  default     = null
  sensitive   = true
}

# High Availability
variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false
}

# Read Replicas
variable "create_read_replica" {
  description = "Create read replica(s)"
  type        = bool
  default     = false
}

variable "read_replica_count" {
  description = "Number of read replicas"
  type        = number
  default     = 1
}

variable "replica_instance_class" {
  description = "Instance class for read replicas"
  type        = string
  default     = null
}

# Backup
variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "Mon:04:00-Mon:05:00"
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot on deletion"
  type        = bool
  default     = false
}

# Monitoring
variable "enabled_cloudwatch_logs_exports" {
  description = "CloudWatch logs to export"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval (0 to disable)"
  type        = number
  default     = 60
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7
}

# Parameters
variable "parameters" {
  description = "Additional database parameters"
  type = list(object({
    name         = string
    value        = string
    apply_method = optional(string)
  }))
  default = []
}

variable "log_min_duration_statement" {
  description = "Log queries taking longer than this (ms)"
  type        = string
  default     = "1000"
}

variable "log_statement" {
  description = "Log statement setting"
  type        = string
  default     = "ddl"
}

# Options
variable "auto_minor_version_upgrade" {
  description = "Enable auto minor version upgrade"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "apply_immediately" {
  description = "Apply changes immediately"
  type        = bool
  default     = false
}

# Secrets Manager
variable "store_credentials_in_secrets_manager" {
  description = "Store credentials in Secrets Manager"
  type        = bool
  default     = true
}

variable "secrets_kms_key_id" {
  description = "KMS key ID for Secrets Manager"
  type        = string
  default     = null
}
