# =============================================================================
# ECR Module Variables
# =============================================================================

variable "repository_name" {
  description = "Name of the ECR repository"
  type        = string
}

variable "image_tag_mutability" {
  description = "Image tag mutability setting (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"
}

variable "scan_on_push" {
  description = "Enable image scanning on push"
  type        = bool
  default     = true
}

variable "encryption_type" {
  description = "Encryption type (AES256 or KMS)"
  type        = string
  default     = "AES256"
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption (required if encryption_type is KMS)"
  type        = string
  default     = null
}

variable "lifecycle_policy" {
  description = "Custom lifecycle policy JSON"
  type        = string
  default     = null
}

variable "enable_default_lifecycle_policy" {
  description = "Enable default lifecycle policy"
  type        = bool
  default     = true
}

variable "max_image_count" {
  description = "Maximum number of images to keep"
  type        = number
  default     = 30
}

variable "untagged_image_expiry_days" {
  description = "Days after which untagged images expire"
  type        = number
  default     = 14
}

variable "repository_policy" {
  description = "Custom repository policy JSON"
  type        = string
  default     = null
}

variable "cross_account_principals" {
  description = "AWS account ARNs for cross-account access"
  type        = list(string)
  default     = []
}
