# =============================================================================
# Secrets Module Variables
# =============================================================================

variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = null
}

# Database
variable "create_database_secret" {
  description = "Create database secret (if not created by RDS module)"
  type        = bool
  default     = false
}

variable "database_username" {
  description = "Database username"
  type        = string
  default     = null
  sensitive   = true
}

variable "database_password" {
  description = "Database password"
  type        = string
  default     = null
  sensitive   = true
}

variable "database_host" {
  description = "Database host"
  type        = string
  default     = null
}

variable "database_port" {
  description = "Database port"
  type        = number
  default     = 5432
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = null
}

# Additional secrets
variable "additional_secrets" {
  description = "Additional secrets to store"
  type        = map(string)
  default     = {}
  sensitive   = true
}

# Service-specific secrets
variable "service_secrets" {
  description = "Map of service name to secrets"
  type        = map(map(string))
  default     = {}
  sensitive   = true
}

# Integration secrets
variable "create_integration_secrets" {
  description = "Create third-party integration secrets"
  type        = bool
  default     = false
}

variable "stripe_api_key" {
  description = "Stripe API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "sendgrid_api_key" {
  description = "SendGrid API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "slack_webhook_url" {
  description = "Slack webhook URL"
  type        = string
  default     = ""
  sensitive   = true
}

variable "sentry_dsn" {
  description = "Sentry DSN"
  type        = string
  default     = ""
  sensitive   = true
}
