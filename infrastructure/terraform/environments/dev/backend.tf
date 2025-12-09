# =============================================================================
# Terraform Backend Configuration - Development
# =============================================================================
# Remote state storage using S3 with DynamoDB locking.
# Run scripts/init-backend.sh before first use to create these resources.
# =============================================================================

terraform {
  backend "s3" {
    # S3 bucket for state storage (replace ACCOUNT_ID with your AWS account ID)
    bucket = "skillancer-terraform-state-ACCOUNT_ID"
    
    # State file path within the bucket
    key = "environments/dev/terraform.tfstate"
    
    # AWS region for the backend resources
    region = "us-east-1"
    
    # Enable encryption at rest
    encrypt = true
    
    # DynamoDB table for state locking
    dynamodb_table = "skillancer-terraform-locks"
    
    # KMS key for encryption (optional, uses default if not specified)
    # kms_key_id = "alias/skillancer-terraform"
    
    # Workspace prefix (for workspace-based environments)
    # workspace_key_prefix = "workspaces"
  }
}
