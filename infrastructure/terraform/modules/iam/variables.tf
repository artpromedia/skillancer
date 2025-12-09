# =============================================================================
# IAM Module Variables
# =============================================================================

variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

# Secrets
variable "secrets_arns" {
  description = "ARNs of secrets to access"
  type        = list(string)
  default     = []
}

variable "kms_key_arns" {
  description = "ARNs of KMS keys for decryption"
  type        = list(string)
  default     = []
}

# S3
variable "s3_bucket_arns" {
  description = "ARNs of S3 buckets and objects to access"
  type        = list(string)
  default     = []
}

# SQS
variable "sqs_queue_arns" {
  description = "ARNs of SQS queues to access"
  type        = list(string)
  default     = []
}

# SNS
variable "sns_topic_arns" {
  description = "ARNs of SNS topics to publish to"
  type        = list(string)
  default     = []
}

# Custom policy
variable "custom_task_policy" {
  description = "Custom IAM policy JSON for task role"
  type        = string
  default     = null
}

# GitHub Actions OIDC
variable "enable_github_oidc" {
  description = "Enable GitHub Actions OIDC role"
  type        = bool
  default     = false
}

variable "github_oidc_provider_arn" {
  description = "ARN of GitHub OIDC provider"
  type        = string
  default     = null
}

variable "github_org" {
  description = "GitHub organization name"
  type        = string
  default     = null
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = null
}

variable "ecr_repository_arns" {
  description = "ARNs of ECR repositories for GitHub Actions"
  type        = list(string)
  default     = []
}
